import { NextResponse } from 'next/server'
import { GoogleAuth } from 'google-auth-library'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse stock strings like "~50kg", "15kg", "0kg", "≈50kg" → integer kg.
 * Returns null for blank / unparseable values.
 */
function parseStockKg(raw: string | null | undefined): number | null {
  if (!raw) return null
  const cleaned = String(raw).replace(/[~≈\s]/g, '')
  const match = cleaned.match(/^(\d+(?:\.\d+)?)kg?$/i)
  return match ? Math.round(parseFloat(match[1])) : null
}

/**
 * Parse a numeric string, stripping common formatting chars ($, %, commas).
 * Returns null for blank / NaN values.
 */
function parseNumeric(raw: string | null | undefined): number | null {
  if (!raw) return null
  const n = parseFloat(String(raw).replace(/[$,%\s]/g, ''))
  return isNaN(n) ? null : n
}

/**
 * Parse a gross profit margin into the 0–1 decimal range the DB expects.
 * Sheets stores it as a percent (e.g. 49.56 or 55.00), so divide by 100.
 * Returns null for blank/unparseable values or anything outside 0–100.
 */
function parseMargin(raw: string | null | undefined): number | null {
  const n = parseNumeric(raw)
  if (n === null) return null
  if (n >= 0 && n <= 1) return n          // already a decimal
  if (n > 1 && n <= 100) return n / 100   // percent → decimal
  return null                             // out of range — don't violate constraint
}

/**
 * Parse a truthy string flag.
 * Blank defaults to active (true) since missing = not explicitly inactive.
 */
function parseActive(raw: string | null | undefined): boolean {
  if (!raw || !raw.trim()) return true
  return ['yes', 'true', '1', 'active', 'y'].includes(raw.toLowerCase().trim())
}

// ---------------------------------------------------------------------------
// Google Sheets fetch
// ---------------------------------------------------------------------------

interface SheetRow {
  [header: string]: string
}

async function fetchSheetRows(): Promise<SheetRow[]> {
  const serviceAccountKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  const sheetId = process.env.GOOGLE_SHEET_ID
  const tabName = process.env.GOOGLE_SHEET_TAB ?? 'product master'

  if (!serviceAccountKeyRaw || !sheetId) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY and GOOGLE_SHEET_ID env vars are required')
  }

  const credentials = JSON.parse(serviceAccountKeyRaw)
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const client = await auth.getClient()
  const token = await client.getAccessToken()

  if (!token.token) throw new Error('Failed to get Google access token')

  // Fetch all data (A:Z covers all columns)
  const encodedTab = encodeURIComponent(tabName)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedTab}!A:Z`

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token.token}` },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Sheets API error ${response.status}: ${text}`)
  }

  const json = await response.json() as { values?: string[][] }
  const values = json.values
  if (!values || values.length < 2) return []  // no data rows

  const headers = values[0]
  return values.slice(1).map((row) => {
    const obj: SheetRow = {}
    headers.forEach((h, i) => { obj[h] = row[i] ?? '' })
    return obj
  })
}

// ---------------------------------------------------------------------------
// Column mapping
// Map sheet header names → DB column names.
// Update header keys below if the actual sheet uses different header text.
// ---------------------------------------------------------------------------
const UPSERT_KEY_HEADER = 'Name (Internal) ENG'

function rowToProduct(row: SheetRow): Record<string, unknown> | null {
  const productId = row[UPSERT_KEY_HEADER]?.trim()
  if (!productId) return null  // skip rows without a product ID

  const defaultPrice = parseNumeric(row['Proposed Selling Price ($)'])

  return {
    product_id:                   productId,
    supplier:                     row['Supplier Name'] || null,
    supplier_product_name:        row['Name (Internal) JPN'] || null,
    customer_facing_product_name: row['Name (External) ENG'] || productId,
    product_type:                 row['Type'] || null,
    landing_cost_per_kg_usd:      parseNumeric(row['US Total Landing Cost /Kg']),
    min_selling_price_usd:        parseNumeric(row['MIN. Selling Price ($)']),
    default_selling_price_usd:    defaultPrice,
    // Keep price_per_kg in sync with default_selling_price_usd for backward compat
    price_per_kg:                 defaultPrice ?? 0,
    gross_profit_margin:          parseMargin(row['Gross Profit Margin']),
    monthly_available_stock_kg:   parseStockKg(row['Available Stock / Month']),
    harvest:                      null,  // no Harvest column in sheet
    tasting_notes:                row['Notes'] || null,
    active:                       parseActive(row['Active']),
    last_synced_at:               new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * POST /api/products/sync
 * Admin-only. Fetches the Google Sheets product master and upserts into
 * the products table, keyed on product_id = "Name (Internal) ENG" column.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    const rows = await fetchSheetRows()

    if (rows.length === 0) {
      return NextResponse.json({ message: 'No data found in sheet', upserted: 0 })
    }

    const products = rows
      .map(rowToProduct)
      .filter((p): p is Record<string, unknown> => p !== null)

    if (products.length === 0) {
      return NextResponse.json({
        message: `Sheet has ${rows.length} rows but none have a valid "${UPSERT_KEY_HEADER}" value`,
        upserted: 0,
      })
    }

    const service = createServiceClient()

    // Upsert keyed on product_id. On conflict, ALL columns are overwritten —
    // this includes supplier_product_name, which corrects any rows where the
    // old sync logic stored product_id as the fallback value instead of the
    // Internal JPN name. No separate backfill query is needed.
    const { error, count } = await service
      .from('products')
      .upsert(products as never, { onConflict: 'product_id', count: 'exact' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Count how many rows had a stale supplier_product_name (= product_id).
    // These are the rows the upsert above just backfilled with the correct JPN name.
    const backfilled = products.filter(
      (p) => p['supplier_product_name'] !== null && p['supplier_product_name'] !== p['product_id'],
    ).length

    return NextResponse.json({
      success: true,
      upserted: count ?? products.length,
      backfilled,
      total_rows: rows.length,
      synced_at: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
