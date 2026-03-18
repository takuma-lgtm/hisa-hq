import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  calculateQuoteLine,
  generateQuoteMessage,
  parseMarginThresholds,
  getSellingPriceForCurrency,
  type QuoteCurrency,
} from '@/lib/quote-pricing'

// ---------------------------------------------------------------------------
// Country → Currency
// ---------------------------------------------------------------------------

const GBP_COUNTRIES = new Set([
  'united kingdom', 'uk', 'england', 'scotland', 'wales', 'northern ireland',
])
const EUR_COUNTRIES = new Set([
  'germany', 'france', 'spain', 'italy', 'netherlands', 'belgium', 'austria',
  'portugal', 'ireland', 'finland', 'greece', 'sweden', 'denmark', 'norway',
  'switzerland', 'poland', 'czech republic', 'hungary',
])

function countryToCurrency(country: string | null): QuoteCurrency {
  if (!country) return 'USD'
  const c = country.trim().toLowerCase()
  if (GBP_COUNTRIES.has(c)) return 'GBP'
  if (EUR_COUNTRIES.has(c)) return 'EUR'
  return 'USD'
}

const CURRENCY_SYMBOL: Record<QuoteCurrency, string> = {
  USD: '$', GBP: '£', EUR: '€',
}

// ---------------------------------------------------------------------------
// POST /api/leads/[id]/analyze
// ---------------------------------------------------------------------------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['owner', 'admin', 'member'].includes(profile.role)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Parse body
  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const message = body.message as string | undefined
  if (!message || message.trim().length === 0) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  const service = createServiceClient()

  // Fetch lead
  const { data: lead, error: leadErr } = await service
    .from('customers')
    .select('customer_id, cafe_name, contact_person, country, city, source_region')
    .eq('customer_id', id)
    .single()
  if (leadErr || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  const currency = countryToCurrency(lead.country)

  // --- Claude extraction ---
  const anthropic = new Anthropic()
  let extraction: {
    product_keywords: string[]
    product_type_guess: string
    estimated_volume_kg: number | null
    volume_frequency: string
    urgency: string
    tone: string
    key_concerns: string[]
    summary: string
  }

  try {
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'You are a sales assistant for HISA Matcha, a B2B Japanese matcha supplier. Extract product interest and volume from buyer messages. Respond ONLY with valid JSON, no markdown fences.',
      messages: [{
        role: 'user',
        content: `Extract from this buyer message:\n"${message.trim()}"\n\nBuyer context: ${lead.cafe_name ?? 'Unknown'}, ${lead.city ?? ''}, ${lead.country ?? ''}\n\nReturn JSON:\n{\n  "product_keywords": ["ceremonial", "latte grade", etc.],\n  "product_type_guess": "ceremonial" | "culinary" | "latte" | "organic" | "unknown",\n  "estimated_volume_kg": number or null,\n  "volume_frequency": "monthly" | "one-time" | "unknown",\n  "urgency": "high" | "medium" | "low",\n  "tone": "formal" | "casual",\n  "key_concerns": ["price", "quality", "samples", etc.],\n  "summary": "one-line summary of what the buyer wants"\n}`,
      }],
    })

    let text = resp.content[0].type === 'text' ? resp.content[0].text : ''
    // Strip markdown code fences if present
    const fenceMatch = text.match(/```(?:json)?\n?([\s\S]*?)```/)
    if (fenceMatch) text = fenceMatch[1]
    extraction = JSON.parse(text.trim())
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to analyze message', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: 422 },
    )
  }

  // --- Product matching ---
  const { data: products } = await service
    .from('products')
    .select('*')
    .eq('active', true)

  if (!products || products.length === 0) {
    return NextResponse.json({
      extraction,
      matched_product: null,
      pricing: null,
      inventory: null,
      draft_reply: 'We currently have no products available. Please check back soon.',
      alternatives: [],
    })
  }

  // Score each product against extraction keywords
  const keywords = extraction.product_keywords.map(k => k.toLowerCase())
  const typeGuess = extraction.product_type_guess?.toLowerCase() ?? ''

  const scored = products.map(p => {
    let score = 0
    const name = (p.customer_facing_product_name ?? '').toLowerCase()
    const type = (p.product_type ?? '').toLowerCase()
    const internal = (p.name_internal_jpn ?? '').toLowerCase()

    for (const kw of keywords) {
      if (name.includes(kw)) score += 3
      if (type.includes(kw)) score += 2
      if (internal.includes(kw)) score += 1
    }
    if (typeGuess && typeGuess !== 'unknown' && type.includes(typeGuess)) score += 4

    // Prefer products with pricing in the target currency
    const hasPrice = getSellingPriceForCurrency(p, currency) != null
    if (hasPrice) score += 1

    return { product: p, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const bestMatch = scored[0].score > 0 ? scored[0].product : scored[0].product // fallback to first active product

  // --- Pricing ---
  const { data: tiers } = await service
    .from('pricing_tiers')
    .select('*')
    .eq('product_id', bestMatch.product_id)

  const { data: settings } = await service
    .from('crm_settings')
    .select('*')
    .eq('category', 'margin_alerts')

  const thresholds = parseMarginThresholds(settings ?? [])
  const volumeKg = extraction.estimated_volume_kg ?? 1

  const quoteLine = calculateQuoteLine(
    { product_id: bestMatch.product_id, volume_kg: volumeKg },
    bestMatch,
    tiers ?? [],
    currency,
    thresholds,
  )

  // --- Inventory ---
  const { data: skuData } = await service
    .from('skus')
    .select('sku_id, product_id, inventory_levels(quantity, in_transit_qty)')
    .eq('product_id', bestMatch.product_id)
    .eq('is_active', true)

  let totalStock = 0
  let totalTransit = 0
  if (skuData) {
    for (const sku of skuData) {
      const levels = sku.inventory_levels as { quantity: number; in_transit_qty: number }[] | null
      for (const level of levels ?? []) {
        totalStock += level.quantity
        totalTransit += level.in_transit_qty
      }
    }
  }

  // --- Draft reply ---
  const draftReply = extraction.estimated_volume_kg
    ? generateQuoteMessage([quoteLine], lead.contact_person, currency)
    : `Hi ${lead.contact_person || 'there'}! 👋\n\nThank you for your interest in our matcha! Based on your message, I'd recommend our ${quoteLine.product_name} at ${CURRENCY_SYMBOL[currency]}${quoteLine.final_price_per_kg.toFixed(2)}/kg.\n\nCould you let me know your estimated monthly volume? This will help me provide you with the best pricing tier.\n\nLooking forward to hearing from you!`

  // --- Alternatives ---
  const alternatives = scored
    .filter(s => s.product.product_id !== bestMatch.product_id)
    .slice(0, 3)
    .map(s => ({
      product_id: s.product.product_id,
      product_name: s.product.customer_facing_product_name ?? s.product.product_id,
      product_type: s.product.product_type ?? 'unknown',
      price_per_kg: getSellingPriceForCurrency(s.product, currency) ?? 0,
    }))

  return NextResponse.json({
    extraction,
    matched_product: {
      product_id: bestMatch.product_id,
      product_name: bestMatch.customer_facing_product_name ?? bestMatch.product_id,
      product_type: bestMatch.product_type ?? 'unknown',
    },
    pricing: {
      currency,
      price_per_kg: quoteLine.final_price_per_kg,
      tier_name: quoteLine.tier_name,
      tier_discount_pct: quoteLine.tier_discount_pct,
      landing_cost_per_kg: quoteLine.landing_cost_per_kg,
      gross_profit_per_kg: quoteLine.gross_profit_per_kg,
      gross_margin_pct: quoteLine.gross_margin_pct,
      margin_health: quoteLine.margin_health,
      is_below_min: quoteLine.is_below_min,
      subtotal: extraction.estimated_volume_kg ? quoteLine.subtotal : null,
    },
    inventory: {
      total_in_stock: totalStock,
      total_in_transit: totalTransit,
      monthly_available_kg: bestMatch.monthly_available_stock_kg ?? null,
      sufficient: extraction.estimated_volume_kg ? totalStock >= extraction.estimated_volume_kg : true,
    },
    draft_reply: draftReply,
    alternatives,
  })
}
