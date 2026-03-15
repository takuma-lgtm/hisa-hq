import { NextResponse } from 'next/server'
import Papa from 'papaparse'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type ProductInsert = Database['public']['Tables']['products']['Insert']

function parseCurrency(raw: string | null | undefined): number | null {
  if (!raw) return null
  const n = parseFloat(String(raw).replace(/[$£€¥,%\s]/g, ''))
  return isNaN(n) ? null : n
}

function parseMargin(raw: string | null | undefined): number | null {
  if (!raw) return null
  const n = parseFloat(String(raw).replace(/[%\s]/g, ''))
  if (isNaN(n)) return null
  return n > 1 ? n / 100 : n
}

function parseStockKg(raw: string | null | undefined): number | null {
  if (!raw) return null
  const cleaned = String(raw).replace(/[~≈\s]/g, '')
  const match = cleaned.match(/^(\d+(?:\.\d+)?)kg?$/i)
  return match ? Math.round(parseFloat(match[1])) : null
}

function parseDateAdded(raw: string | null | undefined): string | null {
  if (!raw) return null
  // Parse "Feb-2026" → "2026-02-01"
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  }
  const match = String(raw).match(/^(\w{3})-(\d{4})$/i)
  if (!match) return null
  const month = months[match[1].toLowerCase()]
  return month ? `${match[2]}-${month}-01` : null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const { csv } = await request.json()
  if (!csv) {
    return NextResponse.json({ error: 'csv field is required' }, { status: 400 })
  }

  const parsed = Papa.parse<string[]>(csv, { header: false, skipEmptyLines: true })
  if (parsed.errors.length > 0) {
    return NextResponse.json({ error: 'CSV parse error', details: parsed.errors }, { status: 400 })
  }

  const rows = parsed.data
  if (rows.length < 2) {
    return NextResponse.json({ error: 'CSV must have a header row and at least one data row' }, { status: 400 })
  }

  // Build column index map from header row
  const headers = rows[0]
  const colIndex: Record<string, number> = {}
  headers.forEach((h, i) => { colIndex[h.trim()] = i })

  const get = (row: string[], col: string): string | null => {
    const idx = colIndex[col]
    if (idx === undefined) return null
    const val = row[idx]?.trim()
    return val || null
  }

  const products: ProductInsert[] = []
  let skipped = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const productId = get(row, 'Name (Internal) ENG')
    if (!productId) { skipped++; continue }

    const isActive = (row[0]?.trim() === '!')
    const externalName = get(row, 'Name (External) ENG')
    const jpnName = get(row, 'Name (Internal) JPN')
    const sellingPriceUsd = parseCurrency(get(row, 'Proposed Selling Price ($)'))

    products.push({
      product_id: productId,
      supplier: get(row, 'Supplier Name'),
      product_type: get(row, 'Type'),
      customer_facing_product_name: externalName || productId,
      supplier_product_name: jpnName || productId,
      name_internal_jpn: jpnName,
      matcha_cost_per_kg_jpy: parseCurrency(get(row, 'Matcha Cost / kg (¥)')),
      landing_cost_per_kg_usd: parseCurrency(get(row, 'US Total Landing Cost /Kg')),
      us_landing_cost_per_kg_usd: parseCurrency(get(row, 'US Total Landing Cost /Kg')),
      uk_landing_cost_per_kg_gbp: parseCurrency(get(row, 'UK Total Landing Cost /Kg')),
      eu_landing_cost_per_kg_eur: parseCurrency(get(row, 'EU Total Landing Cost /Kg')),
      selling_price_usd: sellingPriceUsd,
      default_selling_price_usd: sellingPriceUsd,
      price_per_kg: sellingPriceUsd ?? 0,
      min_price_usd: parseCurrency(get(row, 'MIN. Selling Price ($)')),
      min_selling_price_usd: parseCurrency(get(row, 'MIN. Selling Price ($)')),
      selling_price_gbp: parseCurrency(get(row, 'Proposed Selling Price (£)')),
      min_price_gbp: parseCurrency(get(row, 'MIN. Selling Price (£)')),
      selling_price_eur: parseCurrency(get(row, 'Proposed Selling Price (€)')),
      min_price_eur: parseCurrency(get(row, 'MIN. Selling Price (€)')),
      gross_profit_per_kg_usd: parseCurrency(get(row, 'Gross Profit per kg ($)')),
      gross_profit_margin: parseMargin(get(row, 'Gross Profit Margin')),
      monthly_available_stock_kg: parseStockKg(get(row, 'Available Stock / Month')),
      tasting_notes: get(row, 'Notes'),
      active: isActive,
      date_added: parseDateAdded(get(row, 'Date Added')),
      last_synced_at: new Date().toISOString(),
    })
  }

  if (products.length === 0) {
    return NextResponse.json({ error: 'No valid products found in CSV' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('products')
    .upsert(products, { onConflict: 'product_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    imported: products.length,
    skipped,
    total_rows: rows.length - 1,
  })
}
