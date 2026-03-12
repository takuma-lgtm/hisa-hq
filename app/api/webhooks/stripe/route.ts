import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * POST /api/webhooks/stripe
 * Stripe sends events here. Verifies signature, updates invoice payment status,
 * and creates in-app notifications. Phase 2 feature.
 */
export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  // Dynamic import to avoid bundling stripe in the edge runtime unnecessarily
  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  let event
  try {
    event = stripe.webhooks.constructEvent(body, signature!, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const service = createServiceClient()

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
