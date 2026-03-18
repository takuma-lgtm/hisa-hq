import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type SupplierInsert = Database['public']['Tables']['suppliers']['Insert']

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Fetch suppliers and communication counts in parallel
  const [{ data: suppliers, error }, { data: commCounts }] = await Promise.all([
    service
      .from('suppliers')
      .select('*')
      .order('created_at', { ascending: false }),
    service
      .from('supplier_communications')
      .select('supplier_id'),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate communication counts
  const counts: Record<string, number> = {}
  for (const row of commCounts ?? []) {
    counts[row.supplier_id] = (counts[row.supplier_id] ?? 0) + 1
  }

  return NextResponse.json({ suppliers: suppliers ?? [], commCounts: counts })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const body = await request.json()
  if (!body.supplier_name) {
    return NextResponse.json({ error: 'supplier_name is required' }, { status: 400 })
  }

  // Whitelist allowed fields to prevent arbitrary data insertion
  const ALLOWED_FIELDS = new Set([
    'supplier_name', 'supplier_name_en', 'contact_person', 'email', 'phone',
    'address', 'city', 'prefecture', 'country', 'website_url', 'instagram_url',
    'stage', 'business_type', 'sample_status', 'source', 'specialty',
    'certifications', 'annual_capacity_kg', 'lead_time_days', 'payment_terms',
    'memo', 'action_memo', 'notes', 'assigned_to',
    'first_contacted_at', 'last_contacted_at',
  ])

  const insertData: Record<string, unknown> = {}
  for (const key of Object.keys(body)) {
    if (ALLOWED_FIELDS.has(key)) insertData[key] = body[key]
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('suppliers')
    .insert(insertData as SupplierInsert)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
