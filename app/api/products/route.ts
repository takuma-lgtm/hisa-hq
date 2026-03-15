import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await request.json()
  if (!body.product_id || !body.customer_facing_product_name) {
    return NextResponse.json(
      { error: 'product_id and customer_facing_product_name are required' },
      { status: 400 },
    )
  }

  const service = createServiceClient()

  // Ensure required fields have defaults
  const insertData = {
    supplier_product_name: body.supplier_product_name || body.product_id,
    price_per_kg: body.price_per_kg ?? body.selling_price_usd ?? 0,
    ...body,
  }

  const { data, error } = await service
    .from('products')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data, { status: 201 })
}
