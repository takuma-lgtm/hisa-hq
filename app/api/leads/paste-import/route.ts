import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { normaliseUrl, normaliseName, parseBool, parseDate, detectRegion } from '@/lib/lead-utils'

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

interface ParsedRow {
  date_generated: string | null
  cafe_name: string
  location: string
  serves_matcha: string | null
  instagram_url: string | null
  website_url: string | null
}

interface RequestBody {
  rows: ParsedRow[]
  source_type: string
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin' && profile?.role !== 'lead_gen') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { rows, source_type } = body
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  try {
    // -- 1. Load existing leads for dedup
    const service = createServiceClient()
    const { data: existingLeads, error: fetchErr } = await service
      .from('customers')
      .select('customer_id, instagram_url, website_url, cafe_name, city, country')

    if (fetchErr) throw new Error(fetchErr.message)

    // Build lookup maps
    const byInstagram = new Map<string, string>()
    const byWebsite = new Map<string, string>()
    const byNameLoc = new Map<string, string>()

    for (const c of existingLeads ?? []) {
      if (c.instagram_url) byInstagram.set(c.instagram_url, c.customer_id)
      if (c.website_url) byWebsite.set(c.website_url, c.customer_id)
      const nameLoc = normaliseName(c.cafe_name) + '|' + normaliseName(
        [c.city, c.country].filter(Boolean).join(', ')
      )
      byNameLoc.set(nameLoc, c.customer_id)
    }

    // -- 2. Process each row
    const toInsert: Record<string, unknown>[] = []
    let duplicates = 0

    for (const row of rows) {
      if (!row.cafe_name?.trim()) continue

      const normInstagram = normaliseUrl(row.instagram_url)
      const normWebsite = normaliseUrl(row.website_url)

      const locationParts = (row.location ?? '').split(',').map((s) => s.trim())
      const city = locationParts[0] || null
      const country = locationParts.slice(1).join(', ').trim() || null

      const normNameLoc = normaliseName(row.cafe_name) + '|' + normaliseName(row.location ?? '')

      // Dedupe check: instagram → website → name+city
      const existingId =
        (normInstagram ? byInstagram.get(normInstagram) : undefined) ??
        (normWebsite ? byWebsite.get(normWebsite) : undefined) ??
        byNameLoc.get(normNameLoc)

      if (existingId) {
        duplicates++
        continue
      }

      // Add to dedup maps so we also catch dupes within the pasted batch
      if (normInstagram) byInstagram.set(normInstagram, 'pending')
      if (normWebsite) byWebsite.set(normWebsite, 'pending')
      byNameLoc.set(normNameLoc, 'pending')

      const region = detectRegion(row.location ?? '')

      toInsert.push({
        cafe_name: row.cafe_name.trim(),
        city,
        country,
        serves_matcha: parseBool(row.serves_matcha),
        instagram_url: normInstagram,
        website_url: normWebsite,
        date_generated: parseDate(row.date_generated),
        source_region: region,
        source_type: source_type || 'gemini',
        last_imported_at: new Date().toISOString(),
        status: 'lead',
        lead_stage: 'new_lead',
        is_outbound: true,
        lead_source: 'paste_import',
      })
    }

    // -- 3. Insert
    let imported = 0
    const errors: string[] = []

    if (toInsert.length > 0) {
      const { error: insertErr, count } = await service
        .from('customers')
        .insert(toInsert as never, { count: 'exact' })
      if (insertErr) errors.push(`Insert error: ${insertErr.message}`)
      else imported = count ?? toInsert.length
    }

    return NextResponse.json({
      imported,
      duplicates,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
