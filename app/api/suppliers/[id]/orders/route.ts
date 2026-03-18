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
    .from('supplier_purchase_orders')
    .select('*, items:supplier_purchase_order_items(*)')
    .eq('supplier_id', id)
    .order('order_date', { ascending: false })

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
  const items: { product_id?: string; product_name_jpn?: string; quantity_kg: number; price_per_kg_jpy: number; sku_id?: string; notes?: string }[] = body.items ?? []

  if (items.length === 0) {
    return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 })
  }

  const service = createServiceClient()

  // Generate PO number
  const year = new Date().getFullYear()
  const { data: seqData } = await service.rpc('nextval_text', { seq_name: 'po_number_seq' })
  const seq = String(seqData ?? '1').padStart(3, '0')
  const poNumber = `PO-${year}-${seq}`

  // Calculate total
  const totalAmountJpy = items.reduce((sum, item) => sum + (item.quantity_kg * item.price_per_kg_jpy), 0)

  // Insert PO
  const { data: po, error: poError } = await service
    .from('supplier_purchase_orders')
    .insert({
      po_number: poNumber,
      supplier_id: id,
      order_date: body.order_date ?? new Date().toISOString().split('T')[0],
      expected_delivery: body.expected_delivery ?? null,
      delivery_status: 'pending',
      total_amount_jpy: totalAmountJpy,
      payment_status: 'unpaid',
      notes: body.notes ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (poError) return NextResponse.json({ error: poError.message }, { status: 400 })

  // Insert line items
  const lineItems = items.map((item) => ({
    po_id: po.po_id,
    product_id: item.product_id ?? null,
    product_name_jpn: item.product_name_jpn ?? null,
    quantity_kg: item.quantity_kg,
    price_per_kg_jpy: item.price_per_kg_jpy,
    subtotal_jpy: item.quantity_kg * item.price_per_kg_jpy,
    sku_id: item.sku_id ?? null,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: itemsError } = await (service as any)
    .from('supplier_purchase_order_items')
    .insert(lineItems)

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 400 })

  return NextResponse.json({ ...po, items: lineItems }, { status: 201 })
}
