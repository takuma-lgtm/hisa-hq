import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * POST /api/webhooks/stripe
 * Stripe sends events here. Verifies signature, updates invoice payment status,
 * auto-advances opportunities, and creates draft messages.
 */
export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  // Dynamic import to avoid bundling stripe in the edge runtime unnecessarily
  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  let event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const service = createServiceClient()

  // ---------------------------------------------------------------------------
  // Checkout Session completed (card payments, initial ACH)
  // ---------------------------------------------------------------------------
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    await handlePaymentSuccess(service, session)
  }

  // ---------------------------------------------------------------------------
  // ACH async payment succeeded (ACH takes 3-5 days)
  // ---------------------------------------------------------------------------
  if (event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object
    await handlePaymentSuccess(service, session)
  }

  // ---------------------------------------------------------------------------
  // ACH async payment failed
  // ---------------------------------------------------------------------------
  if (event.type === 'checkout.session.async_payment_failed') {
    const session = event.data.object
    const invoiceId = session.metadata?.invoice_id

    if (invoiceId) {
      await service.from('invoices').update({ payment_status: 'failed' }).eq('invoice_id', invoiceId)
    } else if (session.id) {
      await service.from('invoices').update({ payment_status: 'failed' }).eq('stripe_checkout_session_id', session.id)
    }
  }

  // ---------------------------------------------------------------------------
  // Legacy: payment_intent events (backward compat)
  // ---------------------------------------------------------------------------
  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object
    await service
      .from('invoices')
      .update({ payment_status: 'paid' })
      .eq('stripe_payment_intent', intent.id)
  }

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object
    await service
      .from('invoices')
      .update({ payment_status: 'failed' })
      .eq('stripe_payment_intent', intent.id)
  }

  return NextResponse.json({ received: true })
}

// ---------------------------------------------------------------------------
// Helper: handle successful payment from checkout session
// ---------------------------------------------------------------------------
async function handlePaymentSuccess(
  service: ReturnType<typeof createServiceClient>,
  session: { id: string; metadata?: Record<string, string> | null; payment_intent?: unknown; currency?: string | null; amount_total?: number | null },
) {
  const invoiceId = session.metadata?.invoice_id

  // Find the invoice — by metadata invoice_id or by session ID
  let matchField: string
  let matchValue: string
  if (invoiceId) {
    matchField = 'invoice_id'
    matchValue = invoiceId
  } else {
    matchField = 'stripe_checkout_session_id'
    matchValue = session.id
  }

  const updateData: Record<string, unknown> = {
    payment_status: 'paid',
    paid_at: new Date().toISOString(),
  }
  if (session.payment_intent && typeof session.payment_intent === 'string') {
    updateData.stripe_payment_intent = session.payment_intent
  }

  const { data: invoice } = await service
    .from('invoices')
    .update(updateData)
    .eq(matchField, matchValue)
    .select('invoice_id, opportunity_id, customer_id, amount, currency, invoice_number, recurring_order_id, payment_split_label')
    .single()

  if (!invoice) return

  // Auto-advance opportunity stage (only for opportunity invoices)
  const opportunityId = session.metadata?.opportunity_id ?? invoice.opportunity_id
  if (opportunityId) {
    const { data: opp } = await service
      .from('opportunities')
      .select('stage')
      .eq('opportunity_id', opportunityId)
      .single()

    if (opp?.stage === 'quote_sent') {
      await service.from('opportunities')
        .update({ stage: 'deal_won' })
        .eq('opportunity_id', opportunityId)
    }
  }

  // Update recurring order status if linked
  if (invoice.recurring_order_id) {
    await service
      .from('recurring_orders')
      .update({ status: 'paid' })
      .eq('order_id', invoice.recurring_order_id)
  }

  // Create payment confirmation draft message
  const customerId = session.metadata?.customer_id ?? invoice.customer_id
  if (customerId) {
    const currencyUpper = (session.currency ?? invoice.currency ?? 'USD').toUpperCase()
    const amountFormatted = session.amount_total
      ? (session.amount_total / 100).toFixed(2)
      : Number(invoice.amount).toFixed(2)

    await service.from('draft_messages').insert({
      customer_id: customerId,
      opportunity_id: opportunityId || null,
      trigger_event: 'payment_received',
      channel: 'email',
      message_text: `Hi! This is a confirmation that we've received your payment of ${currencyUpper} ${amountFormatted} for invoice ${session.metadata?.invoice_number ?? invoice.invoice_number ?? ''}. Thank you! We'll get your order processed right away.\n\nBest,\nHisa Matcha`,
      status: 'pending',
    })
  }
}
