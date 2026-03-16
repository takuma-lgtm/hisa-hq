import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orderId } = await params
  const service = createServiceClient()

  const { data, error } = await service
    .from('us_outbound_orders')
    .select(`*, items:us_outbound_order_items(*)`)
    .eq('order_id', orderId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'closer'].includes(profile.role)) {
    return NextResponse.json({ error: 'Admin or closer access required' }, { status: 403 })
  }

  const { orderId } = await params
  const body = await request.json()
  const service = createServiceClient()

  const updates: Record<string, unknown> = {}
  const allowedFields = [
    'status', 'carrier', 'tracking_number', 'tracking_url',
    'delivery_status', 'shipping_cost_usd', 'notes',
    'date_shipped', 'date_delivered', 'date_shipped_from_jp', 'date_received_us',
    'ship_to_name', 'ship_to_address', 'ship_to_city', 'ship_to_state', 'ship_to_zip',
  ]

  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key]
  }

  // Status transition logic
  if (body.status === 'shipped') {
    if (!body.carrier && !body.tracking_number) {
      // Allow shipping without tracking, but set date
    }
    updates.date_shipped = body.date_shipped || new Date().toISOString().split('T')[0]
    updates.delivery_status = 'in_transit'

    // Enable auto-tracking for FedEx
    if (body.carrier?.toLowerCase().includes('fedex') && body.tracking_number) {
      updates.auto_track_enabled = true
    }
  }

  if (body.status === 'delivered') {
    updates.date_delivered = body.date_delivered || new Date().toISOString().split('T')[0]
    updates.delivery_status = 'delivered'
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await service
    .from('us_outbound_orders')
    .update(updates)
    .eq('order_id', orderId)
    .select(`*, items:us_outbound_order_items(*)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Auto-deduct inventory when transitioning to 'shipped'
  if (body.status === 'shipped' && data?.items?.length) {
    try {
      // Get US warehouse
      const { data: usWarehouse } = await service
        .from('warehouse_locations')
        .select('warehouse_id')
        .eq('short_code', 'US')
        .single()

      if (usWarehouse) {
        const trackingFields: Record<string, string> = {}
        if (data.tracking_number) {
          const c = (data.carrier || '').toLowerCase()
          if (c.includes('dhl')) trackingFields.tracking_dhl = data.tracking_number
          else if (c.includes('fedex')) trackingFields.tracking_fedex = data.tracking_number
          else if (c.includes('usps')) trackingFields.tracking_usps = data.tracking_number
          else if (c.includes('ups')) trackingFields.tracking_ups = data.tracking_number
        }

        for (const item of data.items) {
          // Idempotency: check if transaction already exists for this order + SKU
          const { data: existing } = await service
            .from('inventory_transactions')
            .select('transaction_id')
            .eq('transaction_ref', data.order_number)
            .eq('sku_id', item.sku_id)
            .limit(1)

          if (existing && existing.length > 0) continue

          // Create inventory transaction
          await service.from('inventory_transactions').insert({
            sku_id: item.sku_id,
            movement_type: 'us_local_customer',
            qty_change: -item.quantity,
            warehouse_affected: usWarehouse.warehouse_id,
            from_location: 'US Warehouse',
            to_destination: data.customer_name,
            date_shipped: data.date_shipped,
            carrier: data.carrier,
            delivery_status: 'in_transit',
            transaction_ref: data.order_number,
            ...trackingFields,
          })

          // Decrement inventory level
          const { data: level } = await service
            .from('inventory_levels')
            .select('quantity')
            .eq('sku_id', item.sku_id)
            .eq('warehouse_id', usWarehouse.warehouse_id)
            .single()

          if (level) {
            await service
              .from('inventory_levels')
              .update({ quantity: level.quantity - item.quantity })
              .eq('sku_id', item.sku_id)
              .eq('warehouse_id', usWarehouse.warehouse_id)
          }
        }
      }
    } catch (e) {
      // Log but don't fail the order update
      console.error('Auto-deduct inventory failed:', e)
    }
  }

  return NextResponse.json(data)
}
