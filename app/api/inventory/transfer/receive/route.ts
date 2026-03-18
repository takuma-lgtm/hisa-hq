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
  const { sku_id, warehouse_id, quantity, note } = body

  if (!sku_id || !warehouse_id || !quantity || quantity <= 0) {
    return NextResponse.json(
      { error: 'sku_id, warehouse_id, and positive quantity are required' },
      { status: 400 },
    )
  }

  const service = createServiceClient()

  // Update inventory level: move from in_transit to quantity
  const { data: level } = await service
    .from('inventory_levels')
    .select('inventory_level_id, quantity, in_transit_qty')
    .eq('sku_id', sku_id)
    .eq('warehouse_id', warehouse_id)
    .single()

  if (!level) {
    return NextResponse.json({ error: 'Inventory level not found' }, { status: 404 })
  }

  const receiveQty = Math.min(quantity, level.in_transit_qty)

  await service
    .from('inventory_levels')
    .update({
      quantity: level.quantity + receiveQty,
      in_transit_qty: level.in_transit_qty - receiveQty,
      updated_at: new Date().toISOString(),
    })
    .eq('inventory_level_id', level.inventory_level_id)

  // Create a receive transaction record
  await service
    .from('inventory_transactions')
    .insert({
      transaction_ref: `RECV-${Date.now()}`,
      sku_id,
      warehouse_affected: warehouse_id,
      movement_type: 'transfer_jp_us_in',
      qty_change: receiveQty,
      from_location: 'JP Warehouse',
      to_destination: 'US Warehouse',
      date_received: new Date().toISOString().split('T')[0],
      item_type: 'Sample',
      delivery_status: 'delivered',
      note: note || 'Transfer received',
      created_by: user.id,
    })

  return NextResponse.json({ success: true, received: receiveQty })
}
