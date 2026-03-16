/**
 * Stripe Checkout session creation for invoice payments.
 * Supports Card and ACH (US bank account) payment methods.
 */

export interface CreateCheckoutParams {
  amount: number // total in smallest currency unit (cents for USD, pence for GBP)
  currency: string // 'usd', 'gbp', 'eur'
  customerName: string
  customerEmail?: string
  invoiceNumber: string
  description: string // e.g. 'Hisa Matcha - Invoice INV-2026-001'
  paymentMethodTypes: ('card' | 'us_bank_account')[]
  metadata: {
    invoice_id: string
    opportunity_id: string
    customer_id: string
    invoice_number: string
  }
  successUrl: string
  cancelUrl: string
}

export interface CheckoutResult {
  sessionId: string
  checkoutUrl: string
}

export interface CheckoutError {
  error: string
}

export async function createStripeCheckout(
  params: CreateCheckoutParams,
): Promise<CheckoutResult | CheckoutError> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { error: 'Stripe not configured' }
  }

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionParams: any = {
      mode: 'payment',
      payment_method_types: params.paymentMethodTypes,
      line_items: [
        {
          price_data: {
            currency: params.currency.toLowerCase(),
            product_data: {
              name: params.description,
            },
            unit_amount: params.amount,
          },
          quantity: 1,
        },
      ],
      metadata: params.metadata,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.customerEmail || undefined,
    }

    // Enable Plaid bank connection for ACH
    if (params.paymentMethodTypes.includes('us_bank_account')) {
      sessionParams.payment_method_options = {
        us_bank_account: {
          financial_connections: {
            permissions: ['payment_method'],
          },
        },
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return {
      sessionId: session.id,
      checkoutUrl: session.url!,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe checkout creation failed'
    return { error: message }
  }
}

export async function createACHCheckout(
  params: Omit<CreateCheckoutParams, 'paymentMethodTypes'>,
): Promise<CheckoutResult | CheckoutError> {
  return createStripeCheckout({ ...params, paymentMethodTypes: ['us_bank_account'] })
}

export async function createCardCheckout(
  params: Omit<CreateCheckoutParams, 'paymentMethodTypes'>,
): Promise<CheckoutResult | CheckoutError> {
  return createStripeCheckout({ ...params, paymentMethodTypes: ['card'] })
}
