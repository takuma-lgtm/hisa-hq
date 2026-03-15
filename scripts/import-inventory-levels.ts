/**
 * One-time inventory levels import from CSV file.
 *
 * Usage:
 *   npx tsx scripts/import-inventory-levels.ts [path-to-csv]
 *
 * Default CSV path: ~/Downloads/Global Inventory & Logistics - Inventory Overview (JP & US).csv
 *
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * Requires: SKUs to be imported first (run import-skus.ts first)
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
  'Global Inventory & Logistics - Inventory Overview (JP & US).csv',
)

if (!fs.existsSync(csvPath)) {
  console.error(`CSV file not found: ${csvPath}`)
  process.exit(1)
}

console.log(`Reading CSV from: ${csvPath}`)
const csvText = fs.readFileSync(csvPath, 'utf-8')

async function main() {
  const parsed = Papa.parse<string[]>(csvText, { header: false, skipEmptyLines: true })
  const rows = parsed.data

  if (rows.length < 2) {
    console.error('CSV must have a header row and at least one data row')
    process.exit(1)
  }

  // Build column index — handle multi-line headers by matching substrings
  const headers = rows[0]
  const colIndex: Record<string, number> = {}
  headers.forEach((h, i) => { colIndex[h.trim()] = i })

  const findCol = (substring: string): number => {
    const exact = colIndex[substring]
    if (exact !== undefined) return exact
    for (const [h, idx] of Object.entries(colIndex)) {
      if (h.includes(substring)) return idx
    }
    return -1
  }

  const skuNameIdx = findCol('SKU Name')
  const jpStockIdx = findCol('JP Warehouse Stock')
  const usStockIdx = findCol('US Warehouse Stock')
  const inTransitIdx = findCol('In Transit')

  if (skuNameIdx < 0) {
    console.error('Could not find "SKU Name" column')
    process.exit(1)
  }

  // Fetch SKUs and warehouses for ID lookups
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!)

  const [{ data: skus, error: skuErr }, { data: warehouses, error: whErr }] = await Promise.all([
    supabase.from('skus').select('sku_id, sku_name'),
    supabase.from('warehouse_locations').select('warehouse_id, short_code'),
  ])

  if (skuErr || whErr) {
    console.error('Failed to fetch lookups:', skuErr?.message || whErr?.message)
    process.exit(1)
  }

  const skuMap = new Map(skus!.map(s => [s.sku_name, s.sku_id]))
  const jpWarehouseId = warehouses!.find(w => w.short_code === 'JP')?.warehouse_id
  const usWarehouseId = warehouses!.find(w => w.short_code === 'US')?.warehouse_id

  if (!jpWarehouseId || !usWarehouseId) {
    console.error('Could not find JP and US warehouse IDs')
    process.exit(1)
  }

  const levels: Array<Record<string, unknown>> = []
  let skipped = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const skuName = row[skuNameIdx]?.trim()
    if (!skuName) { skipped++; continue }

    const skuId = skuMap.get(skuName)
    if (!skuId) {
      console.warn(`  Row ${i + 1}: SKU "${skuName}" not found — skipping`)
      skipped++
      continue
    }

    const jpStock = jpStockIdx >= 0 ? parseInt(row[jpStockIdx] || '0', 10) : 0
    const usStock = usStockIdx >= 0 ? parseInt(row[usStockIdx] || '0', 10) : 0
    const inTransit = inTransitIdx >= 0 ? parseInt(row[inTransitIdx] || '0', 10) : 0

    // JP warehouse level
    levels.push({
      sku_id: skuId,
      warehouse_id: jpWarehouseId,
      quantity: isNaN(jpStock) ? 0 : jpStock,
      in_transit_qty: 0,
    })

    // US warehouse level
    levels.push({
      sku_id: skuId,
      warehouse_id: usWarehouseId,
      quantity: isNaN(usStock) ? 0 : usStock,
      in_transit_qty: isNaN(inTransit) ? 0 : inTransit,
    })
  }

  console.log(`Parsed ${levels.length} inventory level rows (skipped ${skipped} rows)`)

  const { error } = await supabase
    .from('inventory_levels')
    .upsert(levels, { onConflict: 'sku_id,warehouse_id' })

  if (error) {
    console.error('Upsert failed:', error.message)
    process.exit(1)
  }

  console.log(`Successfully imported ${levels.length} inventory levels`)
}

main()
