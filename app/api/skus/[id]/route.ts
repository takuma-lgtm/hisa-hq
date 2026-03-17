import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth'

const ALLOWED_FIELDS = new Set([
  'sku_name', 'product_id', 'name_external_eng', 'name_internal_jpn',
  'sku_type', 'unit_weight_kg', 'matcha_cost_per_kg_jpy', 'unit_cost_jpy',
  'note', 'is_active',
])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!isAdmin(profile?.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await request.json()
  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key)) updateData[key] = value
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('skus')
    .update(updateData)
    .eq('sku_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
