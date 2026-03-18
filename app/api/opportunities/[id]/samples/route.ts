import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  autoSelectChannel,
  generateShippedMessage,
  createDraftIfNotExists,
} from '@/lib/draft-messages'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: opportunityId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('sample_batches')
    .select('*, items:sample_batch_items(*)')
    .eq('opportunity_id', opportunityId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ batches: data })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: opportunityId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only owner and admin can create sample batches
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const {
    customer_id, carrier, tracking_number, ship_from, shipped_at, items,
    ship_from_warehouse_id,
  } = body

  if (!customer_id) {
    return NextResponse.json({ error: 'customer_id is required' }, { status: 400 })
  }

  const service = createServiceClient()

  // If warehouse specified, validate stock availability up front
  if (ship_from_warehouse_id && items?.length) {
    for (const item of items as { sku_id?: string; qty_grams?: number }[]) {
      if (!item.sku_id) continue
      const { data: level } = await service
        .from('inventory_levels')
        .select('quantity')
        .eq('sku_id', item.sku_id)
        .eq('warehouse_id', ship_from_warehouse_id)
        .single()
      const available = level?.quantity ?? 0
      const needed = item.qty_grams ?? 1
      if (available < needed) {
        return NextResponse.json(
          { error: `Insufficient stock for SKU ${item.sku_id}: ${available} available, ${needed} requested` },
          { status: 400 },
        )
      }
    }
  }

  // Insert sample batch
  const { data: batch, error: batchError } = await supabase
    .from('sample_batches')
    .insert({
      opportunity_id: opportunityId,
      customer_id,
      carrier: carrier ?? null,
      tracking_number: tracking_number ?? null,
      ship_from: ship_from ?? 'US Warehouse',
      shipped_at: shipped_at ?? null,
      date_shipped: shipped_at ? shipped_at.split('T')[0] : null,
      delivery_status: 'in_transit',
    })
    .select()
    .single()

  if (batchError || !batch) {
    return NextResponse.json({ error: batchError?.message ?? 'Failed to create batch' }, { status: 500 })
  }

  // Insert items
  if (items?.length) {
    const { error: itemsError } = await supabase
      .from('sample_batch_items')
      .insert(
        items.map((item: {
          product_id?: string
          sku_id?: string
          product_snapshot?: string
          qty_grams?: number
          notes?: string
        }) => ({
          batch_id: batch.batch_id,
          product_id: item.product_id ?? null,
          product_snapshot: item.product_snapshot ?? null,
          qty_grams: item.qty_grams ?? null,
          notes: item.notes ?? null,
          feedback: 'pending',
        })),
      )

    if (itemsError) {
      await supabase.from('sample_batches').delete().eq('batch_id', batch.batch_id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // Deduct inventory if warehouse specified
    if (ship_from_warehouse_id) {
      for (const item of items as { sku_id?: string; qty_grams?: number }[]) {
        if (!item.sku_id) continue
        const qty = item.qty_grams ?? 1

        // Create inventory transaction
        const { error: txnErr } = await service.from('inventory_transactions').insert({
          sku_id: item.sku_id,
          movement_type: 'outbound_sample',
          qty_change: -qty,
          warehouse_affected: ship_from_warehouse_id,
          opportunity_id: opportunityId,
          customer_id,
          carrier: carrier ?? null,
          delivery_status: 'in_transit',
          note: `Sample batch for opportunity ${opportunityId}`,
          created_by: user.id,
        })

        if (txnErr) {
          console.error(`Failed to create inventory transaction for SKU ${item.sku_id}:`, txnErr.message)
          continue
        }

        // Update inventory level
        const { data: existing } = await service
          .from('inventory_levels')
          .select('inventory_level_id, quantity')
          .eq('sku_id', item.sku_id)
          .eq('warehouse_id', ship_from_warehouse_id)
          .single()

        if (existing) {
          const { error: levelErr } = await service
            .from('inventory_levels')
            .update({
              quantity: existing.quantity - qty,
              updated_at: new Date().toISOString(),
            })
            .eq('inventory_level_id', existing.inventory_level_id)

          if (levelErr) {
            console.error(`Failed to update inventory level for SKU ${item.sku_id}:`, levelErr.message)
          }
        }
      }
    }
  }

  // Advance opportunity stage to samples_shipped
  await supabase
    .from('opportunities')
    .update({ stage: 'samples_shipped', updated_at: new Date().toISOString() })
    .eq('opportunity_id', opportunityId)

  // Fetch full batch with items
  const { data: full, error: fetchError } = await supabase
    .from('sample_batches')
    .select('*, items:sample_batch_items(*)')
    .eq('batch_id', batch.batch_id)
    .single()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  // Create shipped draft message if tracking number provided
  if (tracking_number && customer_id) {
    const { data: customer } = await service
      .from('customers')
      .select('*')
      .eq('customer_id', customer_id)
      .single()

    if (customer && full) {
      const channel = autoSelectChannel(customer)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const batchItems = (full as any).items ?? []
      const messageText = generateShippedMessage(customer, full as never, batchItems)
      await createDraftIfNotExists(service, {
        customer_id,
        opportunity_id: opportunityId,
        batch_id: batch.batch_id,
        trigger_event: 'samples_shipped',
        channel,
        message_text: messageText,
      })
    }
  }

  return NextResponse.json({ batch: full }, { status: 201 })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: opportunityId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { batch_id, tracking_number, carrier, feedback_notes } = body

  if (!batch_id) {
    return NextResponse.json({ error: 'batch_id is required' }, { status: 400 })
  }

  const service = createServiceClient()

  // Verify batch belongs to this opportunity
  const { data: existing } = await service
    .from('sample_batches')
    .select('batch_id, tracking_number, opportunity_id, customer_id')
    .eq('batch_id', batch_id)
    .eq('opportunity_id', opportunityId)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if (tracking_number !== undefined) updates.tracking_number = tracking_number
  if (carrier !== undefined) updates.carrier = carrier
  if (feedback_notes !== undefined) updates.feedback_notes = feedback_notes

  const { data: updated, error } = await service
    .from('sample_batches')
    .update(updates)
    .eq('batch_id', batch_id)
    .select('*, items:sample_batch_items(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create shipped draft if tracking number was just added
  if (tracking_number && !existing.tracking_number) {
    const { data: customer } = await service
      .from('customers')
      .select('*')
      .eq('customer_id', existing.customer_id)
      .single()

    if (customer && updated) {
      const ch = autoSelectChannel(customer)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messageText = generateShippedMessage(customer, updated as never, (updated as any).items ?? [])
      await createDraftIfNotExists(service, {
        customer_id: existing.customer_id,
        opportunity_id: opportunityId,
        batch_id,
        trigger_event: 'samples_shipped',
        channel: ch,
        message_text: messageText,
      })
    }
  }

  return NextResponse.json({ batch: updated })
}
