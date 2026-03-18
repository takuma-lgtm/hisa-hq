import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('supplier_products')
    .select('*, product:products(product_id, customer_facing_product_name, product_type)')
    .eq('supplier_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const body = await request.json()

  const service = createServiceClient()
  const { data, error } = await service
    .from('supplier_products')
    .insert({
      supplier_id: id,
      product_id: body.product_id ?? null,
      product_name_jpn: body.product_name_jpn ?? null,
      cost_per_kg_jpy: body.cost_per_kg_jpy ?? null,
      moq_kg: body.moq_kg ?? null,
      is_primary: body.is_primary ?? false,
      notes: body.notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // If marked as primary, update the products table
  if (body.is_primary && body.product_id) {
    await service
      .from('products')
      .update({ primary_supplier_id: id })
      .eq('product_id', body.product_id)
  }

  return NextResponse.json(data, { status: 201 })
}
