import type { Product, PricingTier, CrmSetting } from '@/types/database'
import {
  getMarginHealth,
  type MarginHealth,
  type MarginThresholds,
  DEFAULT_MARGIN_THRESHOLDS,
} from './margin-health'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QuoteCurrency = 'USD' | 'GBP' | 'EUR'

export interface QuoteLineInput {
  product_id: string
  volume_kg: number
  override_price_per_kg?: number
}

export interface QuoteLineResult {
  product_id: string
  product_name: string
  volume_kg: number
  base_price_per_kg: number
  tier_name: string | null
  tier_discount_pct: number
  final_price_per_kg: number
  subtotal: number
  landing_cost_per_kg: number
  gross_profit_per_kg: number
  gross_margin_pct: number
  margin_health: MarginHealth
  is_below_min: boolean
}

// ---------------------------------------------------------------------------
// Currency helpers
// ---------------------------------------------------------------------------

export function getSellingPriceForCurrency(product: Product, currency: QuoteCurrency): number | null {
  switch (currency) {
    case 'USD': return product.selling_price_usd ?? null
    case 'GBP': return product.selling_price_gbp ?? null
    case 'EUR': return product.selling_price_eur ?? null
  }
}

export function getMinPriceForCurrency(product: Product, currency: QuoteCurrency): number | null {
  switch (currency) {
    case 'USD': return product.min_price_usd ?? null
    case 'GBP': return product.min_price_gbp ?? null
    case 'EUR': return product.min_price_eur ?? null
  }
}

export function getLandingCostForCurrency(product: Product, currency: QuoteCurrency): number | null {
  switch (currency) {
    case 'USD': return product.us_landing_cost_per_kg_usd ?? null
    case 'GBP': return product.uk_landing_cost_per_kg_gbp ?? null
    case 'EUR': return product.eu_landing_cost_per_kg_eur ?? null
  }
}

// ---------------------------------------------------------------------------
// Tier matching
// ---------------------------------------------------------------------------

export function findApplicableTier(
  tiers: PricingTier[],
  volumeKg: number,
  currency: QuoteCurrency,
): PricingTier | null {
  const matching = tiers
    .filter((t) => t.currency === currency && t.min_volume_kg <= volumeKg)
    .sort((a, b) => b.min_volume_kg - a.min_volume_kg)
  return matching[0] ?? null
}

// ---------------------------------------------------------------------------
// Margin thresholds from settings
// ---------------------------------------------------------------------------

export function parseMarginThresholds(settings: CrmSetting[]): MarginThresholds {
  const get = (key: string) => {
    const s = settings.find((s) => s.key === key)
    return s ? parseFloat(s.value) : undefined
  }
  return {
    redProfitUsd: get('margin_alert_red_profit_usd') ?? DEFAULT_MARGIN_THRESHOLDS.redProfitUsd,
    redMarginPct: get('margin_alert_red_margin_pct') ?? DEFAULT_MARGIN_THRESHOLDS.redMarginPct,
    yellowProfitUsd: get('margin_alert_yellow_profit_usd') ?? DEFAULT_MARGIN_THRESHOLDS.yellowProfitUsd,
    yellowMarginPct: get('margin_alert_yellow_margin_pct') ?? DEFAULT_MARGIN_THRESHOLDS.yellowMarginPct,
  }
}

// ---------------------------------------------------------------------------
// Quote line calculation
// ---------------------------------------------------------------------------

export function calculateQuoteLine(
  input: QuoteLineInput,
  product: Product,
  tiers: PricingTier[],
  currency: QuoteCurrency,
  thresholds: MarginThresholds = DEFAULT_MARGIN_THRESHOLDS,
): QuoteLineResult {
  const basePrice = getSellingPriceForCurrency(product, currency) ?? 0
  const minPrice = getMinPriceForCurrency(product, currency)
  const landingCost = getLandingCostForCurrency(product, currency) ?? 0

  let finalPrice: number
  let tierName: string | null = null
  let tierDiscountPct = 0

  if (input.override_price_per_kg != null) {
    finalPrice = input.override_price_per_kg
  } else {
    const tier = findApplicableTier(tiers, input.volume_kg, currency)
    if (tier) {
      finalPrice = tier.price_per_kg
      tierName = tier.tier_name
      tierDiscountPct = tier.discount_pct
    } else {
      finalPrice = basePrice
    }
  }

  const grossProfitPerKg = finalPrice - landingCost
  const grossMarginPct = finalPrice > 0 ? (grossProfitPerKg / finalPrice) * 100 : 0
  const marginDecimal = finalPrice > 0 ? grossProfitPerKg / finalPrice : 0

  return {
    product_id: input.product_id,
    product_name: product.customer_facing_product_name ?? product.product_id,
    volume_kg: input.volume_kg,
    base_price_per_kg: basePrice,
    tier_name: tierName,
    tier_discount_pct: tierDiscountPct,
    final_price_per_kg: finalPrice,
    subtotal: finalPrice * input.volume_kg,
    landing_cost_per_kg: landingCost,
    gross_profit_per_kg: grossProfitPerKg,
    gross_margin_pct: grossMarginPct,
    margin_health: getMarginHealth(marginDecimal, grossProfitPerKg, thresholds),
    is_below_min: minPrice != null ? finalPrice < minPrice : false,
  }
}

// ---------------------------------------------------------------------------
// Quote message generation
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOL: Record<QuoteCurrency, string> = {
  USD: '$',
  GBP: '£',
  EUR: '€',
}

export function generateQuoteMessage(
  lines: QuoteLineResult[],
  contactPerson: string | null,
  currency: QuoteCurrency,
  notes?: string,
): string {
  const sym = CURRENCY_SYMBOL[currency]
  const name = contactPerson || 'there'
  const totalVolume = lines.reduce((s, l) => s + l.volume_kg, 0)
  const totalAmount = lines.reduce((s, l) => s + l.subtotal, 0)

  const productLines = lines
    .map((l) => {
      const tierTag = l.tier_name ? ` (${l.tier_name})` : ''
      return `• ${l.product_name}: ${sym}${l.final_price_per_kg.toFixed(2)}/kg${tierTag}`
    })
    .join('\n')

  let msg = `Hi ${name}! 👋\n\nHere are our matcha prices for ${totalVolume}kg (excl. shipping):\n\n${productLines}\n\nTotal for ${totalVolume}kg: ${sym}${totalAmount.toFixed(2)}`

  if (notes) {
    msg += `\n\n${notes}`
  }

  msg += '\n\nShipping and import tariffs are additional. Let me know if you\'d like to proceed!'

  return msg
}
