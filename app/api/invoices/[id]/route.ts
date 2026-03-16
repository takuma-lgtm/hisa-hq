import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * PATCH /api/invoices/[id] — Update invoice (status, sent_at, sent_via, notes, mark as paid)
 */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'closer'].includes(profile.role)) {
    return NextResponse.json({ error: 'Admin or closer role required' }, { status: 403 })
  }

  const body = await req.json()
  const service = createServiceClient()

  // Build update object from allowed fields
  const allowedFields = ['payment_status', 'paid_at', 'sent_at', 'sent_via', 'notes'] as const
  const updates: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Update the invoice
  const { data: invoice, error } = await service
    .from('invoices')
    .update(updates)
    .eq('invoice_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-advance opportunity if marking as paid (only for opportunity invoices)
  if (body.payment_status === 'paid') {
    if (invoice.opportunity_id) {
      const { data: opp } = await service
        .from('opportunities')
        .select('stage')
        .eq('opportunity_id', invoice.opportunity_id)
        .single()

      if (opp?.stage === 'quote_sent') {
        await service
          .from('opportunities')
          .update({ stage: 'deal_won' })
          .eq('opportunity_id', invoice.opportunity_id)
      }
    }

    // Update recurring order status if linked
    if (invoice.recurring_order_id) {
      await service
        .from('recurring_orders')
        .update({ status: 'paid' })
        .eq('order_id', invoice.recurring_order_id)
    }

    // Create payment_received draft message
    if (invoice.customer_id) {
      const currencyUpper = (invoice.currency ?? 'USD').toUpperCase()
      const splitLabel = invoice.payment_split_label ? ` (${invoice.payment_split_label})` : ''
      await service.from('draft_messages').insert({
        customer_id: invoice.customer_id,
        opportunity_id: invoice.opportunity_id || null,
        trigger_event: 'payment_received',
        channel: 'email',
        message_text: `Hi! This is a confirmation that we've received your payment of ${currencyUpper} ${Number(invoice.amount).toFixed(2)} for invoice ${invoice.invoice_number ?? ''}${splitLabel}. Thank you! We'll get your order processed right away.\n\nBest,\nHisa Matcha`,
        status: 'pending',
      })
    }
  }

  return NextResponse.json(invoice)
}
