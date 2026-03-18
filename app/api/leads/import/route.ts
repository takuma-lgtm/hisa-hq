import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * POST /api/leads/import
 * Accepts a CSV file. Parses rows and bulk-inserts as customers + opportunities.
 * Expected CSV columns (minimum: cafe_name):
 *   cafe_name, instagram_handle, email, phone, city, state, country,
 *   contact_person, cafe_type, monthly_matcha_usage_kg, budget_range
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['owner', 'admin', 'member'].includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No CSV file provided' }, { status: 400 })
  }

  const text = await (file as File).text()

  // Dynamic import of Papa to keep edge bundle small
  const Papa = (await import('papaparse')).default
  const { data: rows, errors } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })

  if (errors.length > 0) {
    return NextResponse.json({ error: 'CSV parse error', details: errors }, { status: 400 })
  }

  const validRows = rows.filter((r) => r.cafe_name?.trim())
  if (!validRows.length) {
    return NextResponse.json({ error: 'No valid rows found. cafe_name is required.' }, { status: 400 })
  }

  const service = createServiceClient()

  const customers = validRows.map((r) => ({
    cafe_name: r.cafe_name.trim(),
    instagram_handle: r.instagram_handle?.trim() || null,
    email: r.email?.trim() || null,
    phone: r.phone?.trim() || null,
    city: r.city?.trim() || null,
    state: r.state?.trim() || null,
    country: r.country?.trim() || null,
    contact_person: r.contact_person?.trim() || null,
    cafe_type: (r.cafe_type?.trim() || null) as
      | 'coffee_shop' | 'matcha_focused' | 'already_serving_matcha' | 'new_to_matcha' | 'other'
      | null,
    monthly_matcha_usage_kg: r.monthly_matcha_usage_kg ? parseFloat(r.monthly_matcha_usage_kg) : null,
    budget_range: r.budget_range?.trim() || null,
    status: 'lead' as const,
  }))

  const { data: inserted, error: insertError } = await service
    .from('customers')
    .insert(customers)
    .select('customer_id')

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Create a lead_created opportunity for each imported customer
  const opportunities = (inserted ?? []).map((c) => ({
    customer_id: c.customer_id,
    stage: 'lead_created' as const,
  }))

  if (opportunities.length) {
    await service.from('opportunities').insert(opportunities)
  }

  return NextResponse.json({
    imported: inserted?.length ?? 0,
    skipped: rows.length - validRows.length,
  })
}
