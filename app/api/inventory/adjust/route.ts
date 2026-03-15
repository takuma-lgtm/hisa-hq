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
  const { sku_id, warehouse_id, qty_change, note } = body

  if (!sku_id || !warehouse_id || qty_change === undefined || qty_change === 0) {
    return NextResponse.json(
      { error: 'sku_id, warehouse_id, and non-zero qty_change are required' },
      { status: 400 },
    )
  }

  if (!note) {
    return NextResponse.json({ error: 'Reason (note) is required for adjustments' }, { status: 400 })
  }

  const service = createServiceClient()

  // Insert adjustment transaction
  const { data: txn, error: txnErr } = await service
    .from('inventory_transactions')
    .insert({
      transaction_ref: `ADJ-${Date.now()}`,
      sku_id,
      warehouse_affected: warehouse_id,
      movement_type: 'adjustment',
      qty_change,
      item_type: 'Sample',
      delivery_status: 'delivered',
      note,
      created_by: user.id,
    })
    .select()
    .single()

  if (txnErr) return NextResponse.json({ error: txnErr.message }, { status: 400 })

  // Update inventory level
  const { data: level } = await service
    .from('inventory_levels')
    .select('inventory_level_id, quantity')
    .eq('sku_id', sku_id)
    .eq('warehouse_id', warehouse_id)
    .single()

  if (level) {
    await service
      .from('inventory_levels')
      .update({
        quantity: level.quantity + qty_change,
        updated_at: new Date().toISOString(),
      })
      .eq('inventory_level_id', level.inventory_level_id)
  } else {
    await service
      .from('inventory_levels')
      .insert({
        sku_id,
        warehouse_id,
        quantity: Math.max(0, qty_change),
        in_transit_qty: 0,
      })
  }

  return NextResponse.json(txn, { status: 201 })
}
