import type { SupabaseClient } from '@supabase/supabase-js'
import type { Customer, SampleBatch, SampleBatchItem, MessageChannel } from '@/types/database'

// ---------------------------------------------------------------------------
// Channel auto-selection
// ---------------------------------------------------------------------------

export function autoSelectChannel(customer: Customer): MessageChannel {
  if (customer.instagram_url) return 'instagram_dm'
  if ((customer as Record<string, unknown>).phone) return 'whatsapp'
  if ((customer as Record<string, unknown>).email) return 'email'
  return 'email'
}

// ---------------------------------------------------------------------------
// Message templates
// ---------------------------------------------------------------------------

export function generateShippedMessage(
  customer: Customer,
  batch: SampleBatch,
  items: SampleBatchItem[],
): string {
  const name = customer.contact_person || customer.cafe_name || 'there'
  const trackingLine = batch.tracking_url
    ? `Tracking: ${batch.tracking_url}`
    : batch.tracking_number
      ? `Tracking number: ${batch.tracking_number}`
      : ''
  const carrierLine = batch.carrier ? `Carrier: ${batch.carrier}` : ''
  const etaLine = batch.estimated_delivery
    ? `Estimated delivery: ${new Date(batch.estimated_delivery).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : 'Estimated delivery: within 3-5 business days'

  const itemLines = items
    .map((it) => `• ${it.product_snapshot || 'Sample'} (${it.qty_grams ?? 0}g)`)
    .join('\n')

  return [
    `Hi ${name}! 🍵`,
    '',
    'Your matcha samples from Hisa Matcha are on the way!',
    '',
    trackingLine,
    carrierLine,
    etaLine,
    '',
    itemLines ? `Items:\n${itemLines}` : '',
    '',
    "Let me know when they arrive — I'd love to hear your thoughts!",
    '',
    'Best,',
    'Hisa Matcha',
  ]
    .filter((line) => line !== '')
    .join('\n')
}

export function generateDeliveredMessage(
  customer: Customer,
  _batch: SampleBatch,
  _items: SampleBatchItem[],
): string {
  const name = customer.contact_person || customer.cafe_name || 'there'
  const cafeName = customer.cafe_name || 'your café'

  return [
    `Hi ${name}! 👋`,
    '',
    'Just wanted to let you know your matcha samples have been delivered!',
    '',
    `I'd love to hear your thoughts whenever you get a chance to try them. A few questions that would help me find the perfect match for ${cafeName}:`,
    '',
    '1. Which samples did you like most?',
    "2. How does the flavor/color compare to what you're currently using?",
    '3. What volume would you be looking at monthly?',
    '',
    "No rush — happy to chat whenever works for you!",
    '',
    'Best,',
    'Hisa Matcha',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Idempotent draft creation
// ---------------------------------------------------------------------------

export async function createDraftIfNotExists(
  service: SupabaseClient,
  params: {
    customer_id: string
    opportunity_id: string
    batch_id: string
    trigger_event: string
    channel: string
    message_text: string
  },
): Promise<boolean> {
  // Check for existing pending draft with same batch + trigger
  const { data: existing } = await service
    .from('draft_messages')
    .select('draft_id')
    .eq('batch_id', params.batch_id)
    .eq('trigger_event', params.trigger_event)
    .eq('status', 'pending')
    .limit(1)

  if (existing && existing.length > 0) {
    return false // already exists
  }

  const { error } = await service.from('draft_messages').insert({
    customer_id: params.customer_id,
    opportunity_id: params.opportunity_id,
    batch_id: params.batch_id,
    trigger_event: params.trigger_event,
    channel: params.channel,
    message_text: params.message_text,
  })

  if (error) {
    console.error('Failed to create draft message:', error.message)
    return false
  }

  return true
}
