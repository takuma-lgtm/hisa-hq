import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { normaliseUrl, normaliseName, detectRegion } from '@/lib/lead-utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApifyRow {
  place_id: string
  cafe_name: string
  address: string
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  phone: string | null
  website_url: string | null
  email: string | null
  instagram_url: string | null
  google_rating: number | null
  google_review_count: number | null
  category: string | null
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // Auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  let body: { rows: ApifyRow[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { rows } = body
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  try {
    const service = createServiceClient()

    // Load existing leads for dedup
    const { data: existingLeads, error: fetchErr } = await service
      .from('customers')
      .select(
        'customer_id, instagram_url, website_url, cafe_name, city, country, google_place_id',
      )

    if (fetchErr) throw new Error(fetchErr.message)

    // Build dedup maps
    const byPlaceId = new Map<string, string>()
    const byInstagram = new Map<string, string>()
    const byWebsite = new Map<string, string>()
    const byNameLoc = new Map<string, string>()

    for (const c of existingLeads ?? []) {
      if (c.google_place_id)
        byPlaceId.set(c.google_place_id, c.customer_id)
      if (c.instagram_url) byInstagram.set(c.instagram_url, c.customer_id)
      if (c.website_url) byWebsite.set(c.website_url, c.customer_id)
      const nameLoc =
        normaliseName(c.cafe_name) +
        '|' +
        normaliseName([c.city, c.country].filter(Boolean).join(', '))
      byNameLoc.set(nameLoc, c.customer_id)
    }

    // Process rows
    const toInsert: Record<string, unknown>[] = []
    let duplicates = 0

    for (const row of rows) {
      if (!row.cafe_name?.trim()) continue

      // Dedup: place_id → instagram → website → name+location
      if (row.place_id && byPlaceId.has(row.place_id)) {
        duplicates++
        continue
      }

      const normInstagram = normaliseUrl(row.instagram_url)
      const normWebsite = normaliseUrl(row.website_url)
      const locationStr = [row.city, row.country].filter(Boolean).join(', ')
      const normNameLoc =
        normaliseName(row.cafe_name) + '|' + normaliseName(locationStr)

      const existingId =
        (normInstagram ? byInstagram.get(normInstagram) : undefined) ??
        (normWebsite ? byWebsite.get(normWebsite) : undefined) ??
        byNameLoc.get(normNameLoc)

      if (existingId) {
        duplicates++
        continue
      }

      // Track within batch
      if (row.place_id) byPlaceId.set(row.place_id, 'pending')
      if (normInstagram) byInstagram.set(normInstagram, 'pending')
      if (normWebsite) byWebsite.set(normWebsite, 'pending')
      byNameLoc.set(normNameLoc, 'pending')

      const region = detectRegion(
        row.country ?? locationStr,
      )

      toInsert.push({
        cafe_name: row.cafe_name.trim(),
        address: row.address || null,
        city: row.city || null,
        state: row.state || null,
        zip_code: row.zip_code || null,
        country: row.country || null,
        phone: row.phone || null,
        website_url: normWebsite,
        email: row.email || null,
        instagram_url: normInstagram,
        google_place_id: row.place_id || null,
        google_rating: row.google_rating,
        google_review_count: row.google_review_count,
        source_type: 'google_maps',
        source_region: region,
        date_generated: new Date().toISOString().slice(0, 10),
        last_imported_at: new Date().toISOString(),
        status: 'lead',
        lead_stage: 'new_lead',
        is_outbound: true,
        lead_source: 'apify_google_maps',
      })
    }

    // Insert
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
