import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { normaliseUrl, normaliseName, detectRegion } from '@/lib/lead-utils'

// ---------------------------------------------------------------------------
// Request type
// ---------------------------------------------------------------------------

interface ManualLeadBody {
  cafe_name: string
  city?: string | null
  country?: string | null
  instagram_url?: string | null
  website_url?: string | null
  email?: string | null
  contact_person?: string | null
  phone?: string | null
  notes?: string | null
  serves_matcha?: boolean | null
  force?: boolean // skip dedup when true ("Add Anyway")
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

  if (profile?.role !== 'admin' && profile?.role !== 'lead_gen') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  let body: ManualLeadBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.cafe_name?.trim()) {
    return NextResponse.json(
      { error: 'cafe_name is required' },
      { status: 400 },
    )
  }

  try {
    const service = createServiceClient()

    const normInstagram = normaliseUrl(body.instagram_url)
    const normWebsite = normaliseUrl(body.website_url)
    const locationStr = [body.city, body.country].filter(Boolean).join(', ')
    const normNameLoc =
      normaliseName(body.cafe_name) + '|' + normaliseName(locationStr)

    // Dedup check (unless force=true)
    if (!body.force) {
      const { data: existing, error: fetchErr } = await service
        .from('customers')
        .select('customer_id, cafe_name, city, country, instagram_url, website_url')

      if (fetchErr) throw new Error(fetchErr.message)

      for (const c of existing ?? []) {
        const match =
          (normInstagram && normaliseUrl(c.instagram_url) === normInstagram) ||
          (normWebsite && normaliseUrl(c.website_url) === normWebsite) ||
          (normaliseName(c.cafe_name) +
            '|' +
            normaliseName(
              [c.city, c.country].filter(Boolean).join(', '),
            )) === normNameLoc

        if (match) {
          return NextResponse.json({
            duplicate: true,
            existing: {
              customer_id: c.customer_id,
              cafe_name: c.cafe_name,
              city: c.city,
              country: c.country,
            },
          })
        }
      }
    }

    // Insert
    const region = detectRegion(body.country ?? locationStr)

    const { data: created, error: insertErr } = await service
      .from('customers')
      .insert({
        cafe_name: body.cafe_name.trim(),
        city: body.city?.trim() || null,
        country: body.country?.trim() || null,
        instagram_url: normInstagram,
        website_url: normWebsite,
        email: body.email?.trim() || null,
        contact_person: body.contact_person?.trim() || null,
        phone: body.phone?.trim() || null,
        notes: body.notes?.trim() || null,
        serves_matcha: body.serves_matcha ?? null,
        source_type: 'manual',
        source_region: region,
        date_generated: new Date().toISOString().slice(0, 10),
        last_imported_at: new Date().toISOString(),
        status: 'lead' as const,
        lead_stage: 'new_lead' as const,
        is_outbound: true,
        lead_source: 'manual',
      } as never)
      .select('customer_id, cafe_name')
      .single()

    if (insertErr) {
      return NextResponse.json(
        { error: `Insert error: ${insertErr.message}` },
        { status: 500 },
      )
    }

    return NextResponse.json({ created })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
