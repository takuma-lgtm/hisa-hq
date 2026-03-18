import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createACHCheckout, createCardCheckout } from '@/lib/stripe-payments'
import { getWiseBankDetails } from '@/lib/wise-payments'
import type { PaymentMethod, InvoiceLineItem, Database } from '@/types/database'

type InvoiceInsert = Database['public']['Tables']['invoices']['Insert']

/**
 * POST /api/invoices — Create a new invoice
 * GET  /api/invoices?opportunity_id=xxx  — List invoices for an opportunity
 * GET  /api/invoices?customer_id=xxx     — List invoices for a customer
 * GET  /api/invoices?payment_group_id=xx — List invoices in a split group
 */

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const opportunityId = req.nextUrl.searchParams.get('opportunity_id')
  const customerId = req.nextUrl.searchParams.get('customer_id')
  const paymentGroupId = req.nextUrl.searchParams.get('payment_group_id')

  const service = createServiceClient()
  let query = service.from('invoices').select('*').order('created_at', { ascending: false })

  if (paymentGroupId) {
    query = query.eq('payment_group_id', paymentGroupId)
  } else if (opportunityId) {
    query = query.eq('opportunity_id', opportunityId)
  } else if (customerId) {
    query = query.eq('customer_id', customerId)
  } else {
    return NextResponse.json({ error: 'opportunity_id, customer_id, or payment_group_id is required' }, { status: 400 })
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Admin or closer role required' }, { status: 403 })
  }

  const body = await req.json()
  const {
    opportunity_id,
    customer_id,
    payment_method,
    currency = 'USD',
    line_items,
    total_amount,
    due_date,
    notes,
    payment_split_label,
    payment_group_id,
    create_recurring_order,
  } = body as {
    opportunity_id?: string | null
    customer_id: string
    payment_method: PaymentMethod
    currency: string
    line_items: InvoiceLineItem[]
    total_amount: number
    due_date: string | null
    notes: string | null
    payment_split_label?: string | null
    payment_group_id?: string | null
    create_recurring_order?: boolean
  }

  if (!customer_id || !payment_method || !total_amount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (total_amount <= 0) {
    return NextResponse.json({ error: 'total_amount must be greater than 0' }, { status: 400 })
  }

  // ACH only supports USD
  if (payment_method === 'stripe_ach' && currency.toUpperCase() !== 'USD') {
    return NextResponse.json({ error: 'ACH payments only support USD currency' }, { status: 400 })
  }

  const service = createServiceClient()

  // Generate invoice number
  const { data: seqRow, error: seqErr } = await service.rpc('nextval_text', { seq_name: 'invoice_number_seq' })
  let invoiceNumber: string
  if (seqErr || !seqRow) {
    invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`
  } else {
    const num = typeof seqRow === 'string' ? parseInt(seqRow, 10) : Number(seqRow)
    invoiceNumber = `INV-${new Date().getFullYear()}-${String(num).padStart(3, '0')}`
  }

  // Look up customer name
  const { data: customer } = await service
    .from('customers')
    .select('cafe_name, email')
    .eq('customer_id', customer_id)
    .single()

  const customerName = customer?.cafe_name ?? 'Customer'

  // If requested, create a recurring order and link it
  let recurringOrderId: string | null = null
  if (create_recurring_order) {
    const { data: recOrder, error: recErr } = await service
      .from('recurring_orders')
      .insert({
        customer_id,
        line_items: line_items as unknown as Database['public']['Tables']['recurring_orders']['Insert']['line_items'],
        total_amount,
        status: 'pending',
        currency,
        assigned_closer: user.id,
      })
      .select('order_id')
      .single()

    if (recErr) {
      return NextResponse.json({ error: `Failed to create recurring order: ${recErr.message}` }, { status: 500 })
    }
    recurringOrderId = recOrder.order_id
  }

  // Base invoice data
  const invoiceData: InvoiceInsert = {
    opportunity_id: opportunity_id || null,
    customer_id,
    amount: total_amount,
    currency,
    payment_method,
    payment_status: 'pending',
    invoice_number: invoiceNumber,
    customer_name: customerName,
    line_items_detail: line_items as unknown as InvoiceInsert['line_items_detail'],
    due_date: due_date || null,
    notes: notes || null,
    recurring_order_id: recurringOrderId,
    payment_split_label: payment_split_label || null,
    payment_group_id: payment_group_id || null,
  }

  // Determine redirect URLs based on context
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hisa-hq.vercel.app'
  const isRecurring = !opportunity_id
  const successUrl = isRecurring
    ? `${appUrl}/recurring/${customer_id}?payment=success`
    : `${appUrl}/opportunities?payment=success`
  const cancelUrl = isRecurring
    ? `${appUrl}/recurring/${customer_id}?payment=cancelled`
    : `${appUrl}/opportunities?payment=cancelled`

  // Payment method specific logic
  if (payment_method === 'stripe_ach' || payment_method === 'stripe_card') {
    const amountInSmallestUnit = Math.round(total_amount * 100)
    const splitDesc = payment_split_label ? ` (${payment_split_label})` : ''
    const checkoutParams = {
      amount: amountInSmallestUnit,
      currency: currency.toLowerCase(),
      customerName,
      customerEmail: customer?.email || undefined,
      invoiceNumber,
      description: `Hisa Matcha - Invoice ${invoiceNumber}${splitDesc}`,
      metadata: {
        invoice_id: '', // will be set after insert
        opportunity_id: opportunity_id || '',
        customer_id,
        invoice_number: invoiceNumber,
      },
      successUrl,
      cancelUrl,
    }

    const createFn = payment_method === 'stripe_ach' ? createACHCheckout : createCardCheckout
    const result = await createFn(checkoutParams)

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    invoiceData.stripe_payment_link = result.checkoutUrl
    invoiceData.stripe_checkout_session_id = result.sessionId
  } else if (payment_method === 'wise_transfer') {
    const { data: settings } = await service
      .from('crm_settings')
      .select('*')
      .eq('category', 'payments')

    const bankDetails = getWiseBankDetails(currency, settings ?? [])
    invoiceData.wise_bank_details = bankDetails ? JSON.parse(JSON.stringify(bankDetails)) : null
    invoiceData.wise_transfer_reference = invoiceNumber
  } else if (payment_method === 'zelle') {
    const { data: settings } = await service
      .from('crm_settings')
      .select('value')
      .eq('key', 'zelle_email')
      .single()

    invoiceData.zelle_email = settings?.value ?? 'info@hisamatcha.com'
  }

  // Insert the invoice
  const { data: invoice, error: insertErr } = await service
    .from('invoices')
    .insert(invoiceData)
    .select()
    .single()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // Link recurring order back to invoice
  if (recurringOrderId) {
    await service.from('recurring_orders')
      .update({ invoice_id: invoice.invoice_id })
      .eq('order_id', recurringOrderId)
  }

  // For Stripe: update the checkout session metadata with the actual invoice_id
  if ((payment_method === 'stripe_ach' || payment_method === 'stripe_card') && invoice.stripe_checkout_session_id) {
    try {
      if (process.env.STRIPE_SECRET_KEY) {
        const Stripe = (await import('stripe')).default
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
        await stripe.checkout.sessions.update(invoice.stripe_checkout_session_id, {
          metadata: {
            invoice_id: invoice.invoice_id,
            opportunity_id: opportunity_id || '',
            customer_id,
            invoice_number: invoiceNumber,
          },
        })
      }
    } catch {
      // Non-critical: metadata update failed, webhook can still match by session ID
    }
  }

  return NextResponse.json(invoice, { status: 201 })
}
