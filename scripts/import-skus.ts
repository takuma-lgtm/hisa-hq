/**
 * One-time SKU import from CSV file.
 *
 * Usage:
 *   npx tsx scripts/import-skus.ts [path-to-csv]
 *
 * Default CSV path: ~/Downloads/Global Inventory & Logistics - SKU & Destination Overview (1).csv
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    } else {
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
  'Global Inventory & Logistics - SKU & Destination Overview (1).csv',
)

if (!fs.existsSync(csvPath)) {
  console.error(`CSV file not found: ${csvPath}`)
  process.exit(1)
}

console.log(`Reading CSV from: ${csvPath}`)
const csvText = fs.readFileSync(csvPath, 'utf-8')

function parseCurrency(raw: string | null | undefined): number | null {
  if (!raw) return null
  const n = parseFloat(String(raw).replace(/[$£€¥,%\s]/g, ''))
  return isNaN(n) ? null : n
}

function inferWeightFromName(skuName: string): number {
  if (skuName.includes('_1kg')) return 1
  if (skuName.includes('_30g')) return 0.03
  if (skuName.includes('_50g')) return 0.05
  if (skuName.includes('_100g')) return 0.1
  return 0.03 // default to sample size
}

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

  const skus: Array<Record<string, unknown>> = []
  let skipped = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const skuName = get(row, 'SKU Name')
    if (!skuName) { skipped++; continue }

    const unitWeightRaw = get(row, 'Unit Weight')
    const unitWeight = unitWeightRaw ? parseFloat(unitWeightRaw) : inferWeightFromName(skuName)

    skus.push({
      sku_name: skuName,
      product_id: get(row, 'Name (Internal) ENG'),
      name_external_eng: get(row, 'Name (External) ENG'),
      name_internal_jpn: get(row, 'Name (Internal)'),
      sku_type: get(row, 'Type') || 'Sample',
      unit_weight_kg: isNaN(unitWeight) ? 0.03 : unitWeight,
      matcha_cost_per_kg_jpy: parseCurrency(get(row, 'Matcha Cost / kg (¥)')),
      unit_cost_jpy: parseCurrency(get(row, 'Matcha Unit Cost (¥)')),
      note: get(row, 'Note'),
      is_active: true,
    })
  }

  console.log(`Parsed ${skus.length} SKUs (skipped ${skipped} rows without SKU name)`)

  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!)
  const { error } = await supabase
    .from('skus')
    .upsert(skus, { onConflict: 'sku_name' })

  if (error) {
    console.error('Upsert failed:', error.message)
    process.exit(1)
  }

  console.log(`Successfully imported ${skus.length} SKUs`)
}

main()
