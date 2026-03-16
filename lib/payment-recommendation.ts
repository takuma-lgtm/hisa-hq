/**
 * Payment method recommendation logic.
 * Suggests the best payment method based on customer country and currency.
 */

import type { PaymentMethod } from '@/types/database'

export interface PaymentMethodOption {
  method: PaymentMethod
  label: string
  description: string
  recommended: boolean
  feeEstimate: string
  autoConfirmed: boolean
}

const US_COUNTRY_VALUES = new Set(['United States', 'US', 'USA', 'us', 'usa'])

function isUSCustomer(country: string | null): boolean {
  return !!country && US_COUNTRY_VALUES.has(country)
}

export function getRecommendedPaymentMethod(
  customerCountry: string | null,
  _currency: string,
  _amount: number,
): PaymentMethod {
  if (isUSCustomer(customerCountry)) return 'stripe_ach'
  return 'wise_transfer'
}

export function getAllPaymentMethods(
  customerCountry: string | null,
  _currency: string,
  amount: number = 0,
): PaymentMethodOption[] {
  const recommended = getRecommendedPaymentMethod(customerCountry, _currency, amount)

  if (isUSCustomer(customerCountry)) {
    return [
      {
        method: 'stripe_ach',
        label: 'Bank Transfer (ACH)',
        description: 'Bank debit via Stripe. 0.8% fee, $5 max. Auto-confirmed.',
        recommended: recommended === 'stripe_ach',
        feeEstimate: `~$${Math.min(amount * 0.008, 5).toFixed(2)} (0.8%, $5 max)`,
        autoConfirmed: true,
      },
      {
        method: 'zelle',
        label: 'Zelle',
        description: 'Free, instant. Customer sends to your Zelle email. Manual confirmation.',
        recommended: recommended === 'zelle',
        feeEstimate: 'Free',
        autoConfirmed: false,
      },
      {
        method: 'stripe_card',
        label: 'Card',
        description: 'Credit/debit card via Stripe. 2.9% + $0.30. Auto-confirmed.',
        recommended: recommended === 'stripe_card',
        feeEstimate: `~$${(amount * 0.029 + 0.30).toFixed(2)} (2.9% + $0.30)`,
        autoConfirmed: true,
      },
      {
        method: 'wise_transfer',
        label: 'Bank Transfer (Wise)',
        description: 'International bank transfer. ~1% fee. Manual confirmation.',
        recommended: recommended === 'wise_transfer',
        feeEstimate: `~$${(amount * 0.01).toFixed(2)} (~1%)`,
        autoConfirmed: false,
      },
    ]
  }

  // International customers — only Wise and Card
  return [
    {
      method: 'wise_transfer',
      label: 'Bank Transfer (Wise)',
      description: 'Bank transfer to your Wise account. Low fees. Manual confirmation.',
      recommended: recommended === 'wise_transfer',
      feeEstimate: `~${_currency === 'GBP' ? '£' : _currency === 'EUR' ? '€' : '$'}${(amount * 0.01).toFixed(2)} (~1%)`,
      autoConfirmed: false,
    },
    {
      method: 'stripe_card',
      label: 'Card',
      description: 'Credit/debit card via Stripe. 3.9%+ fee. Auto-confirmed.',
      recommended: recommended === 'stripe_card',
      feeEstimate: `~${_currency === 'GBP' ? '£' : _currency === 'EUR' ? '€' : '$'}${(amount * 0.039 + 0.30).toFixed(2)} (3.9% + $0.30)`,
      autoConfirmed: true,
    },
  ]
}
