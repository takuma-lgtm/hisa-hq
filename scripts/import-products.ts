/**
 * One-time product import from CSV file.
 *
 * Usage:
 *   npx tsx scripts/import-products.ts [path-to-csv]
 *
 * Default CSV path: ~/Downloads/Global Operations - Product Master.csv
 *
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
import { createClient } from '@supabase/supabase-js'

// Load .env.local manually
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    } else {
      // Strip inline comments (only for unquoted values)
      const hashIdx = value.indexOf('   #')
      if (hashIdx > 0) value = value.slice(0, hashIdx).trim()
    }
    if (!process.env[key]) process.env[key] = value
  }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const csvPath = process.argv[2] || path.join(
  process.env.HOME || '~',
  'Downloads',
  'Global Operations - Product Master.csv',
)

if (!fs.existsSync(csvPath)) {
  console.error(`CSV file not found: ${csvPath}`)
  process.exit(1)
}

console.log(`Reading CSV from: ${csvPath}`)
const csvText = fs.readFileSync(csvPath, 'utf-8')

// --- Parsers ---

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
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  }
  const match = String(raw).match(/^(\w{3})-(\d{4})$/i)
  if (!match) return null
  const month = months[match[1].toLowerCase()]
  return month ? `${match[2]}-${month}-01` : null
}

// --- Main ---

async function main() {
  const parsed = Papa.parse<string[]>(csvText, { header: false, skipEmptyLines: true })
  const rows = parsed.data

  if (rows.length < 2) {
    console.error('CSV must have a header row and at least one data row')
    process.exit(1)
  }

  const headers = rows[0]
  const colIndex: Record<string, number> = {}
  headers.forEach((h, i) => { colIndex[h.trim()] = i })

  const get = (row: string[], col: string): string | null => {
    const idx = colIndex[col]
    if (idx === undefined) return null
    const val = row[idx]?.trim()
    return val || null
  }

  const products: Array<Record<string, unknown>> = []
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

  console.log(`Parsed ${products.length} products (skipped ${skipped} rows without product_id)`)

  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!)
  const { error } = await supabase
    .from('products')
    .upsert(products, { onConflict: 'product_id' })

  if (error) {
    console.error('Upsert failed:', error.message)
    process.exit(1)
  }

  console.log(`Successfully imported ${products.length} products`)
}

main()
