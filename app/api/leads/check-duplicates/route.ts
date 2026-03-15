import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { normaliseUrl, normaliseName } from '@/lib/lead-utils'

interface CheckRow {
  cafe_name: string
  location: string
  instagram_url: string | null
  website_url: string | null
  google_place_id?: string | null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { rows: CheckRow[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { rows } = body
  if (!Array.isArray(rows)) {
    return NextResponse.json({ error: 'rows must be an array' }, { status: 400 })
  }

  try {
    const service = createServiceClient()
    const { data: existing, error } = await service
      .from('customers')
      .select('customer_id, instagram_url, website_url, cafe_name, city, country, google_place_id')

    if (error) throw new Error(error.message)

    // Build lookup maps
    const byPlaceId = new Set<string>()
    const byInstagram = new Set<string>()
    const byWebsite = new Set<string>()
    const byNameLoc = new Set<string>()

    for (const c of existing ?? []) {
      if (c.google_place_id) byPlaceId.add(c.google_place_id)
      if (c.instagram_url) byInstagram.add(c.instagram_url)
      if (c.website_url) byWebsite.add(c.website_url)
      byNameLoc.add(
        normaliseName(c.cafe_name) + '|' + normaliseName([c.city, c.country].filter(Boolean).join(', '))
      )
    }

    // Check each row: google_place_id → instagram → website → name+location
    const duplicates: boolean[] = rows.map((row) => {
      if (row.google_place_id && byPlaceId.has(row.google_place_id)) return true

      const normIg = normaliseUrl(row.instagram_url)
      const normWeb = normaliseUrl(row.website_url)
      const normNL = normaliseName(row.cafe_name) + '|' + normaliseName(row.location ?? '')

      return (
        (normIg ? byInstagram.has(normIg) : false) ||
        (normWeb ? byWebsite.has(normWeb) : false) ||
        byNameLoc.has(normNL)
      )
    })

    return NextResponse.json({ duplicates })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
