/**
 * One-time inventory transaction log import from CSV file.
 *
 * Usage:
 *   npx tsx scripts/import-inventory-log.ts [path-to-csv]
 *
 * Default CSV path: ~/Downloads/Global Inventory & Logistics - Inventory Log.csv
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
  'Global Inventory & Logistics - Inventory Log.csv',
)

if (!fs.existsSync(csvPath)) {
  console.error(`CSV file not found: ${csvPath}`)
  process.exit(1)
}

console.log(`Reading CSV from: ${csvPath}`)
const csvText = fs.readFileSync(csvPath, 'utf-8')

/** Parse M/D/YYYY to YYYY-MM-DD */
function parseDate(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null
  const parts = raw.trim().split('/')
  if (parts.length !== 3) return null
  const [m, d, y] = parts
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

/** Map spreadsheet movement type to our internal code */
function mapMovementType(raw: string, qtyChange: number): string {
  const s = raw.trim()
  if (s.startsWith('Inbound')) return 'inbound_supplier_jp'
  if (s.startsWith('Transfer')) {
    return qtyChange < 0 ? 'transfer_jp_us_out' : 'transfer_jp_us_in'
  }
  if (s.includes('non-US') || s.includes('non‑US')) return 'direct_jp_intl_customer'
  if (s.includes('JP') && s.includes('US Customer')) return 'direct_jp_us_customer'
  if (s.startsWith('US Local')) return 'us_local_customer'
  if (s.startsWith('Personal')) return 'personal_use'
  return 'adjustment'
}

function mapDeliveryStatus(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return 'pending'
  const s = raw.trim().toLowerCase()
  if (s === 'delivered') return 'delivered'
  if (s === 'in transit') return 'in_transit'
  return 'pending'
}

async function main() {
  const parsed = Papa.parse<string[]>(csvText, { header: false, skipEmptyLines: true })
  const rows = parsed.data

  if (rows.length < 2) {
    console.error('CSV must have a header row and at least one data row')
    process.exit(1)
  }

  // Build column index from the header row
  // Note: multi-line headers (e.g. "Tracking #\n(USPS)") are handled by papaparse
  const headers = rows[0]
  const colIndex: Record<string, number> = {}
  headers.forEach((h, i) => { colIndex[h.trim()] = i })

  // Fuzzy column finder for multi-line header columns like "Tracking #\n(USPS)"
  const findCol = (substring: string): number => {
    const exact = colIndex[substring]
    if (exact !== undefined) return exact
    for (const [h, idx] of Object.entries(colIndex)) {
      if (h.includes(substring)) return idx
    }
    return -1
  }

  const get = (row: string[], col: string): string | null => {
    const idx = colIndex[col]
    if (idx === undefined) return null
    const val = row[idx]?.trim()
    return val || null
  }

  const getFuzzy = (row: string[], substring: string): string | null => {
    const idx = findCol(substring)
    if (idx < 0) return null
    const val = row[idx]?.trim()
    return val || null
  }

  // Fetch SKUs and warehouses for ID lookups
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!)

  const [{ data: skus, error: skuErr }, { data: warehouses, error: whErr }] = await Promise.all([
    supabase.from('skus').select('sku_id, sku_name'),
    supabase.from('warehouse_locations').select('warehouse_id, name'),
  ])

  if (skuErr || whErr) {
    console.error('Failed to fetch lookups:', skuErr?.message || whErr?.message)
    process.exit(1)
  }

  const skuMap = new Map(skus!.map(s => [s.sku_name, s.sku_id]))
  const warehouseMap = new Map(warehouses!.map(w => [w.name, w.warehouse_id]))

  const transactions: Array<Record<string, unknown>> = []
  let skipped = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const skuName = get(row, 'SKU Name')
    if (!skuName) { skipped++; continue }

    const skuId = skuMap.get(skuName)
    if (!skuId) {
      console.warn(`  Row ${i + 1}: SKU "${skuName}" not found — skipping`)
      skipped++
      continue
    }

    const warehouseName = get(row, 'Impacted Stock Location at Time of Transaction')
    const warehouseId = warehouseName ? warehouseMap.get(warehouseName) : null

    const qtyChangeRaw = get(row, 'Qty Change (Pcs)')
    const qtyChange = qtyChangeRaw ? parseInt(qtyChangeRaw, 10) : 0

    const movementTypeRaw = get(row, 'Movement Type') || ''

    transactions.push({
      transaction_ref: get(row, 'Transaction ID'),
      date_received: parseDate(get(row, 'Date Received')),
      date_shipped: parseDate(get(row, 'Date Shipped')),
      item_type: get(row, 'Item Type') || 'Sample',
      movement_type: mapMovementType(movementTypeRaw, qtyChange),
      from_location: get(row, 'From (Source)'),
      to_destination: get(row, 'To (Destination)'),
      sku_id: skuId,
      warehouse_affected: warehouseId,
      qty_change: qtyChange,
      carrier: get(row, 'Shipping Carrier'),
      delivery_status: mapDeliveryStatus(get(row, 'Delivery Status')),
      tracking_dhl: get(row, 'Tracking # (DHL)'),
      tracking_fedex: get(row, 'Tracking # (FedEx)'),
      tracking_usps: getFuzzy(row, 'USPS'),
      tracking_ups: get(row, 'Tracking # (UPS)'),
      note: get(row, 'Note'),
    })
  }

  console.log(`Parsed ${transactions.length} transactions (skipped ${skipped} rows)`)

  // Insert in batches of 50
  const BATCH_SIZE = 50
  let inserted = 0
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('inventory_transactions').insert(batch)
    if (error) {
      console.error(`Insert failed at batch starting row ${i}:`, error.message)
      process.exit(1)
    }
    inserted += batch.length
  }

  console.log(`Successfully imported ${inserted} transactions`)
}

main()
