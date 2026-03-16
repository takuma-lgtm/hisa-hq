import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { trackPackage } from '@/lib/fedex'
import {
  autoSelectChannel,
  generateDeliveredMessage,
  createDraftIfNotExists,
} from '@/lib/draft-messages'

import crypto from 'crypto'

function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  if (authHeader.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
}

export async function POST(request: Request) {
  // Verify cron secret (timing-safe comparison)
  if (!process.env.CRON_SECRET || !verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()

  // Check if FedEx tracking is enabled
  const { data: setting } = await service
    .from('crm_settings')
    .select('value')
    .eq('key', 'fedex_enabled')
    .single()

  if (setting?.value !== 'true') {
    return NextResponse.json({ message: 'FedEx tracking disabled', tracked: 0 })
  }

  // Get poll interval from settings
  const { data: intervalSetting } = await service
    .from('crm_settings')
    .select('value')
    .eq('key', 'tracking_poll_interval_hours')
    .single()
  const pollHours = parseInt(intervalSetting?.value ?? '2', 10) || 2

  // Find batches needing tracking
  const staleThreshold = new Date(Date.now() - pollHours * 60 * 60 * 1000).toISOString()

  const { data: batches, error: fetchError } = await service
    .from('sample_batches')
    .select('batch_id, tracking_number, carrier, carrier_status, delivery_status, opportunity_id, customer_id')
    .not('tracking_number', 'is', null)
    .eq('auto_track_enabled', true)
    .ilike('carrier', 'fedex%')
    .neq('delivery_status', 'delivered')
    .or(`last_tracked_at.is.null,last_tracked_at.lt.${staleThreshold}`)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  let tracked = 0
  let delivered = 0
  const errors: string[] = []

  for (const batch of batches ?? []) {
    try {
      const result = await trackPackage(batch.tracking_number!)
      tracked++

      // Update batch with tracking data
      await service
        .from('sample_batches')
        .update({
          carrier_status: result.status,
          carrier_status_detail: result.statusDetail,
          estimated_delivery: result.estimatedDelivery,
          tracking_url: result.trackingUrl,
          last_tracked_at: new Date().toISOString(),
        })
        .eq('batch_id', batch.batch_id)

      // Handle delivery detection
      if (result.status === 'delivered' && batch.delivery_status !== 'delivered') {
        delivered++

        // Update batch delivery status
        await service
          .from('sample_batches')
          .update({
            delivery_status: 'delivered',
            delivered_at: result.actualDelivery ?? new Date().toISOString(),
          })
          .eq('batch_id', batch.batch_id)

        // Advance opportunity stage from samples_shipped → samples_delivered
        const { data: opp } = await service
          .from('opportunities')
          .select('stage')
          .eq('opportunity_id', batch.opportunity_id)
          .single()

        if (opp?.stage === 'samples_shipped') {
          await service
            .from('opportunities')
            .update({
              stage: 'samples_delivered' as never,
              updated_at: new Date().toISOString(),
            })
            .eq('opportunity_id', batch.opportunity_id)
        }

        // Create delivered draft message
        const { data: customer } = await service
          .from('customers')
          .select('*')
          .eq('customer_id', batch.customer_id)
          .single()

        if (customer) {
          const { data: items } = await service
            .from('sample_batch_items')
            .select('*')
            .eq('batch_id', batch.batch_id)

          const channel = autoSelectChannel(customer)
          const messageText = generateDeliveredMessage(customer, batch as never, items ?? [])

          await createDraftIfNotExists(service, {
            customer_id: batch.customer_id,
            opportunity_id: batch.opportunity_id,
            batch_id: batch.batch_id,
            trigger_event: 'samples_delivered',
            channel,
            message_text: messageText,
          })
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      errors.push(`${batch.batch_id}: ${msg}`)
    }
  }

  // ---- Track inventory transactions with FedEx tracking ----
  const { data: invTxns } = await service
    .from('inventory_transactions')
    .select('transaction_id, tracking_fedex, delivery_status, movement_type, sku_id, warehouse_affected, qty_change')
    .not('tracking_fedex', 'is', null)
    .eq('auto_track_enabled', true)
    .neq('delivery_status', 'delivered')
    .or(`last_tracked_at.is.null,last_tracked_at.lt.${staleThreshold}`)

  for (const txn of invTxns ?? []) {
    try {
      const result = await trackPackage(txn.tracking_fedex!)
      tracked++

      await service
        .from('inventory_transactions')
        .update({
          delivery_status: result.status === 'delivered' ? 'delivered' : 'in_transit',
          last_tracked_at: new Date().toISOString(),
        })
        .eq('transaction_id', txn.transaction_id)

      // If a JP→US transfer is delivered, auto-receive
      if (result.status === 'delivered' && txn.movement_type === 'transfer_jp_us_out') {
        const { data: usWarehouse } = await service
          .from('warehouse_locations')
          .select('warehouse_id')
          .eq('short_code', 'US')
          .single()

        if (usWarehouse) {
          const { data: level } = await service
            .from('inventory_levels')
            .select('inventory_level_id, quantity, in_transit_qty')
            .eq('sku_id', txn.sku_id)
            .eq('warehouse_id', usWarehouse.warehouse_id)
            .single()

          if (level && level.in_transit_qty > 0) {
            const receiveQty = Math.abs(txn.qty_change ?? 0)
            const actualReceive = Math.min(receiveQty, level.in_transit_qty)
            await service
              .from('inventory_levels')
              .update({
                quantity: level.quantity + actualReceive,
                in_transit_qty: level.in_transit_qty - actualReceive,
                updated_at: new Date().toISOString(),
              })
              .eq('inventory_level_id', level.inventory_level_id)
            delivered++
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      errors.push(`inv-txn-${txn.transaction_id}: ${msg}`)
    }
  }

  // ---- Track US outbound orders with FedEx tracking ----
  const { data: usOrders } = await service
    .from('us_outbound_orders')
    .select('order_id, tracking_number, delivery_status')
    .not('tracking_number', 'is', null)
    .eq('auto_track_enabled', true)
    .neq('delivery_status', 'delivered')
    .or(`last_tracked_at.is.null,last_tracked_at.lt.${staleThreshold}`)

  for (const order of usOrders ?? []) {
    try {
      const result = await trackPackage(order.tracking_number!)
      tracked++

      const updates: Record<string, unknown> = {
        delivery_status: result.status === 'delivered' ? 'delivered' : 'in_transit',
        last_tracked_at: new Date().toISOString(),
      }

      if (result.status === 'delivered') {
        updates.status = 'delivered'
        updates.date_delivered = result.actualDelivery?.split('T')[0] ?? new Date().toISOString().split('T')[0]
        delivered++
      }

      await service
        .from('us_outbound_orders')
        .update(updates)
        .eq('order_id', order.order_id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      errors.push(`us-order-${order.order_id}: ${msg}`)
    }
  }

  return NextResponse.json({ tracked, delivered, errors })
}
