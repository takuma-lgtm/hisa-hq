import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ALLOWED_FIELDS = new Set([
  'order_date', 'expected_delivery', 'actual_delivery',
  'delivery_status', 'total_amount_jpy', 'payment_status',
  'payment_date', 'quality_rating', 'notes',
])

async function autoInboundOnDelivery(service: ReturnType<typeof createServiceClient>, poId: string, userId: string) {
  // Fetch PO number and items with sku info (sku_id added in migration 025)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: po } = await (service as any)
    .from('supplier_purchase_orders')
    .select('po_number, items:supplier_purchase_order_items(item_id, sku_id, quantity_kg)')
    .eq('po_id', poId)
    .single() as { data: { po_number: string; items: { item_id: string; sku_id: string | null; quantity_kg: number }[] } | null }

  if (!po) return

  // Find JP warehouse
  const { data: warehouses } = await service
    .from('warehouse_locations')
    .select('warehouse_id, short_code')
  const jpWarehouse = warehouses?.find(w => w.short_code === 'JP')
  if (!jpWarehouse) return

  for (const item of po.items ?? []) {
    if (!item.sku_id || !item.quantity_kg) continue

    // Idempotency: skip if transaction already exists for this PO + SKU
    const ref = `${po.po_number}-${item.sku_id}`
    const { data: existing } = await service
      .from('inventory_transactions')
      .select('transaction_id')
      .eq('transaction_ref', ref)
      .maybeSingle()
    if (existing) continue

    // Get SKU unit weight to convert kg → units
    const { data: sku } = await service
      .from('skus')
      .select('unit_weight_kg')
      .eq('sku_id', item.sku_id)
      .single()

    const unitWeight = sku?.unit_weight_kg ?? 0
    const units = unitWeight > 0 ? Math.round(item.quantity_kg / unitWeight) : Math.round(item.quantity_kg)
    if (units <= 0) continue

    // Insert inbound transaction
    await service.from('inventory_transactions').insert({
      transaction_ref: ref,
      sku_id: item.sku_id,
      warehouse_affected: jpWarehouse.warehouse_id,
      movement_type: 'inbound_from_supplier',
      qty_change: units,
      from_location: 'Supplier',
      to_destination: 'JP Warehouse',
      date_received: new Date().toISOString().split('T')[0],
      item_type: 'Product',
      delivery_status: 'delivered',
      note: `Auto-inbound from ${po.po_number}`,
      created_by: userId,
    })

    // Upsert inventory level at JP warehouse
    const { data: level } = await service
      .from('inventory_levels')
      .select('inventory_level_id, quantity')
      .eq('sku_id', item.sku_id)
      .eq('warehouse_id', jpWarehouse.warehouse_id)
      .maybeSingle()

    if (level) {
      await service
        .from('inventory_levels')
        .update({ quantity: level.quantity + units, updated_at: new Date().toISOString() })
        .eq('inventory_level_id', level.inventory_level_id)
    } else {
      await service
        .from('inventory_levels')
        .insert({ sku_id: item.sku_id, warehouse_id: jpWarehouse.warehouse_id, quantity: units, in_transit_qty: 0 })
    }
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; poId: string }> },
) {
  const { poId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('supplier_purchase_orders')
    .select('*, items:supplier_purchase_order_items(*)')
    .eq('po_id', poId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; poId: string }> },
) {
  const { poId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const body = await request.json()
  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key)) {
      updateData[key] = value
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const service = createServiceClient()

  // Fetch current status before updating to detect transition to 'delivered'
  const { data: current } = await service
    .from('supplier_purchase_orders')
    .select('delivery_status')
    .eq('po_id', poId)
    .single()

  const { data, error } = await service
    .from('supplier_purchase_orders')
    .update(updateData)
    .eq('po_id', poId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Auto-inbound inventory when status transitions to 'delivered'
  if (
    updateData.delivery_status === 'delivered' &&
    current?.delivery_status !== 'delivered'
  ) {
    await autoInboundOnDelivery(service, poId, user.id)
  }

  return NextResponse.json(data)
}
