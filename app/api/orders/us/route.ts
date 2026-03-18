import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const service = createServiceClient()
  let query = service
    .from('us_outbound_orders')
    .select(`
      *,
      items:us_outbound_order_items(*)
    `)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Admin or closer access required' }, { status: 403 })
  }

  const body = await request.json()
  const { customer_id, customer_name, ship_to_name, ship_to_address, ship_to_city, ship_to_state, ship_to_zip, ship_to_country, notes, items } = body

  if (!customer_name || !items || items.length === 0) {
    return NextResponse.json({ error: 'customer_name and at least one item required' }, { status: 400 })
  }

  const service = createServiceClient()

  // Generate order number
  const year = new Date().getFullYear()
  const { data: seqData } = await service.rpc('nextval_text', { seq_name: 'us_order_seq' })
  const seq = String(seqData ?? '1').padStart(3, '0')
  const orderNumber = `USO-${year}-${seq}`

  // Look up US warehouse
  const { data: usWarehouse } = await service
    .from('warehouse_locations')
    .select('warehouse_id')
    .eq('short_code', 'US')
    .single()

  if (!usWarehouse) {
    return NextResponse.json({ error: 'US warehouse not configured' }, { status: 500 })
  }

  // Validate stock and calculate totals
  let totalValue = 0
  for (const item of items) {
    const { data: level } = await service
      .from('inventory_levels')
      .select('inventory_level_id, quantity')
      .eq('sku_id', item.sku_id)
      .eq('warehouse_id', usWarehouse.warehouse_id)
      .single()

    if (!level || level.quantity < item.quantity) {
      return NextResponse.json(
        { error: `Insufficient US stock for ${item.sku_name}: have ${level?.quantity ?? 0}, need ${item.quantity}` },
        { status: 400 },
      )
    }
    totalValue += (item.unit_value_usd ?? 0) * item.quantity
  }

  // Create order
  const { data: order, error: orderErr } = await service
    .from('us_outbound_orders')
    .insert({
      order_number: orderNumber,
      customer_id: customer_id || null,
      customer_name,
      ship_to_name: ship_to_name || customer_name,
      ship_to_address,
      ship_to_city,
      ship_to_state,
      ship_to_zip,
      ship_to_country: ship_to_country || 'United States',
      total_item_value_usd: totalValue,
      notes,
      created_by: user.id,
    })
    .select()
    .single()

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 400 })

  // Create order items + deduct stock + create transactions
  for (const item of items) {
    // Insert order item
    await service.from('us_outbound_order_items').insert({
      order_id: order.order_id,
      sku_id: item.sku_id,
      sku_name: item.sku_name,
      product_description: item.product_description,
      quantity: item.quantity,
      unit_value_usd: item.unit_value_usd,
      subtotal_usd: (item.unit_value_usd ?? 0) * item.quantity,
    })

    // Deduct US warehouse stock
    const { data: level } = await service
      .from('inventory_levels')
      .select('inventory_level_id, quantity')
      .eq('sku_id', item.sku_id)
      .eq('warehouse_id', usWarehouse.warehouse_id)
      .single()

    if (level) {
      await service
        .from('inventory_levels')
        .update({
          quantity: level.quantity - item.quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('inventory_level_id', level.inventory_level_id)
    }

    // Create inventory transaction
    await service.from('inventory_transactions').insert({
      transaction_ref: orderNumber,
      sku_id: item.sku_id,
      warehouse_affected: usWarehouse.warehouse_id,
      movement_type: 'us_local_customer',
      qty_change: -item.quantity,
      from_location: 'US Warehouse',
      to_destination: customer_name,
      date_shipped: new Date().toISOString().split('T')[0],
      item_type: 'Sample',
      delivery_status: 'pending',
      created_by: user.id,
    })
  }

  // Fetch complete order with items
  const { data: complete } = await service
    .from('us_outbound_orders')
    .select(`*, items:us_outbound_order_items(*)`)
    .eq('order_id', order.order_id)
    .single()

  return NextResponse.json(complete, { status: 201 })
}
