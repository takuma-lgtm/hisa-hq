import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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
  const { sku_id, quantity, carrier, tracking_dhl, tracking_fedex, tracking_usps, tracking_ups, note, transaction_ref } = body

  if (!sku_id || !quantity || quantity <= 0) {
    return NextResponse.json(
      { error: 'sku_id and positive quantity are required' },
      { status: 400 },
    )
  }

  const service = createServiceClient()

  // Look up JP and US warehouse IDs
  const { data: warehouses } = await service
    .from('warehouse_locations')
    .select('warehouse_id, short_code')

  const jpWarehouse = warehouses?.find(w => w.short_code === 'JP')
  const usWarehouse = warehouses?.find(w => w.short_code === 'US')

  if (!jpWarehouse || !usWarehouse) {
    return NextResponse.json({ error: 'Warehouses not configured' }, { status: 500 })
  }

  const trackingFields = { tracking_dhl, tracking_fedex, tracking_usps, tracking_ups }
  const ref = transaction_ref || `TR-${Date.now()}`

  // 1. Outbound transaction from JP
  const { error: outErr } = await service
    .from('inventory_transactions')
    .insert({
      transaction_ref: `${ref}-OUT`,
      sku_id,
      warehouse_affected: jpWarehouse.warehouse_id,
      movement_type: 'transfer_jp_us_out',
      qty_change: -quantity,
      from_location: 'JP Warehouse',
      to_destination: 'US Warehouse',
      date_shipped: new Date().toISOString().split('T')[0],
      item_type: 'Sample',
      carrier,
      delivery_status: 'in_transit',
      note,
      created_by: user.id,
      ...trackingFields,
    })

  if (outErr) return NextResponse.json({ error: outErr.message }, { status: 400 })

  // 2. Inbound transaction to US (marked as in_transit)
  const { error: inErr } = await service
    .from('inventory_transactions')
    .insert({
      transaction_ref: `${ref}-IN`,
      sku_id,
      warehouse_affected: usWarehouse.warehouse_id,
      movement_type: 'transfer_jp_us_in',
      qty_change: quantity,
      from_location: 'JP Warehouse',
      to_destination: 'US Warehouse',
      date_shipped: new Date().toISOString().split('T')[0],
      item_type: 'Sample',
      carrier,
      delivery_status: 'in_transit',
      note,
      created_by: user.id,
      ...trackingFields,
    })

  if (inErr) return NextResponse.json({ error: inErr.message }, { status: 400 })

  // 3. Update JP warehouse level (decrease quantity)
  const { data: jpLevel } = await service
    .from('inventory_levels')
    .select('inventory_level_id, quantity')
    .eq('sku_id', sku_id)
    .eq('warehouse_id', jpWarehouse.warehouse_id)
    .single()

  if (jpLevel) {
    await service
      .from('inventory_levels')
      .update({
        quantity: jpLevel.quantity - quantity,
        updated_at: new Date().toISOString(),
      })
      .eq('inventory_level_id', jpLevel.inventory_level_id)
  }

  // 4. Update US warehouse level (increase in_transit)
  const { data: usLevel } = await service
    .from('inventory_levels')
    .select('inventory_level_id, in_transit_qty')
    .eq('sku_id', sku_id)
    .eq('warehouse_id', usWarehouse.warehouse_id)
    .single()

  if (usLevel) {
    await service
      .from('inventory_levels')
      .update({
        in_transit_qty: usLevel.in_transit_qty + quantity,
        updated_at: new Date().toISOString(),
      })
      .eq('inventory_level_id', usLevel.inventory_level_id)
  } else {
    await service
      .from('inventory_levels')
      .insert({
        sku_id,
        warehouse_id: usWarehouse.warehouse_id,
        quantity: 0,
        in_transit_qty: quantity,
      })
  }

  return NextResponse.json({ success: true, ref }, { status: 201 })
}
