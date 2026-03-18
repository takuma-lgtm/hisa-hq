import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { trackPackage } from '@/lib/fedex'
import {
  autoSelectChannel,
  generateDeliveredMessage,
  createDraftIfNotExists,
} from '@/lib/draft-messages'

export async function POST(request: Request) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { batch_id } = await request.json()
  if (!batch_id) {
    return NextResponse.json({ error: 'batch_id is required' }, { status: 400 })
  }

  const service = createServiceClient()

  // Fetch the batch
  const { data: batch, error: batchError } = await service
    .from('sample_batches')
    .select('*')
    .eq('batch_id', batch_id)
    .single()

  if (batchError || !batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  if (!batch.tracking_number) {
    return NextResponse.json({ error: 'No tracking number on this batch' }, { status: 400 })
  }

  if (!batch.carrier?.toLowerCase().startsWith('fedex')) {
    return NextResponse.json({ error: 'Auto-tracking only available for FedEx' }, { status: 400 })
  }

  // Track the package
  const result = await trackPackage(batch.tracking_number)

  // Update batch
  await service
    .from('sample_batches')
    .update({
      carrier_status: result.status,
      carrier_status_detail: result.statusDetail,
      estimated_delivery: result.estimatedDelivery,
      tracking_url: result.trackingUrl,
      last_tracked_at: new Date().toISOString(),
    })
    .eq('batch_id', batch_id)

  // Handle delivery
  if (result.status === 'delivered' && batch.delivery_status !== 'delivered') {
    await service
      .from('sample_batches')
      .update({
        delivery_status: 'delivered',
        delivered_at: result.actualDelivery ?? new Date().toISOString(),
      })
      .eq('batch_id', batch_id)

    // Advance opportunity stage
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
        .eq('batch_id', batch_id)

      const channel = autoSelectChannel(customer)
      const messageText = generateDeliveredMessage(customer, batch as never, items ?? [])

      await createDraftIfNotExists(service, {
        customer_id: batch.customer_id,
        opportunity_id: batch.opportunity_id,
        batch_id: batch_id,
        trigger_event: 'samples_delivered',
        channel,
        message_text: messageText,
      })
    }
  }

  return NextResponse.json({
    tracking: result,
    delivery_status: result.status === 'delivered' ? 'delivered' : batch.delivery_status,
  })
}
