import { NextResponse } from 'next/server'
import { GoogleAuth } from 'google-auth-library'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Configuration — tab list is driven by the LEADS_SHEET_TABS env var
// (comma-separated, e.g. "United States,Europe,Asia")
// Add or remove tabs in .env.local without touching this file.
// ---------------------------------------------------------------------------

const LEAD_TABS = (process.env.LEADS_SHEET_TABS ?? '')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean)

// Sheet column header → semantic field. Adjust if sheet headers change.
const COLUMN_MAP = {
  cafeName:      'Cafe Name',
  location:      'Location',
  servesMatcha:  'Serves Matcha?',
  instagramUrl:  'Instagram URL',
  websiteUrl:    'Website URL',
  platform:      'Platform Used',
  dateGenerated: 'Date Generated',
  contactPerson: 'Contact Person',
  dateContacted: 'Date Contacted',
} as const

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function parseBool(raw: string | undefined): boolean | null {
  if (!raw?.trim()) return null
  return ['yes', 'true', '1', 'y'].includes(raw.toLowerCase().trim())
}

function parseDate(raw: string | undefined): string | null {
  if (!raw?.trim()) return null
  const d = new Date(raw.trim())
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

/** Strip protocol, www, and trailing slashes for dedupe comparison. */
function normaliseUrl(raw: string | undefined): string | null {
  if (!raw?.trim()) return null
  return raw
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/+$/, '')
}

/** Lowercase + strip punctuation for cafe name fuzzy matching. */
function normaliseName(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------------------
// Google Sheets fetch — same pattern as /api/products/sync
// ---------------------------------------------------------------------------

interface SheetRow { [header: string]: string }

async function fetchTabRows(
  token: string,
  sheetId: string,
  tabName: string,
): Promise<SheetRow[]> {
  const encodedTab = encodeURIComponent(tabName)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedTab}!A:Z`

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Sheets API error for tab "${tabName}": ${response.status} ${text}`)
  }

  const json = await response.json() as { values?: string[][] }
  const values = json.values
  if (!values || values.length < 2) return []

  const headers = values[0]
  return values.slice(1).map((row) => {
    const obj: SheetRow = {}
    headers.forEach((h, i) => { obj[h] = row[i] ?? '' })
    return obj
  })
}

// ---------------------------------------------------------------------------
// Row → DB record mapping
// ---------------------------------------------------------------------------

interface LeadRecord {
  cafe_name: string
  city: string | null
  country: string | null
  serves_matcha: boolean | null
  instagram_url: string | null
  website_url: string | null
  platform_used: string | null
  date_generated: string | null
  contact_person: string | null
  date_contacted: string | null
  source_region: string
  last_imported_at: string
  // For dedupe lookups (not written to DB separately)
  _normInstagram: string | null
  _normWebsite: string | null
  _normNameLoc: string
}

function rowToLead(row: SheetRow, region: string): LeadRecord | null {
  const cafeName = row[COLUMN_MAP.cafeName]?.trim()
  if (!cafeName) return null

  // Parse "City, Country" or "City" from the Location column
  const rawLocation = row[COLUMN_MAP.location]?.trim() ?? ''
  const locationParts = rawLocation.split(',').map((s) => s.trim())
  const city    = locationParts[0] || null
  const country = locationParts[1] || null

  const instagramUrl = normaliseUrl(row[COLUMN_MAP.instagramUrl])
  const websiteUrl   = normaliseUrl(row[COLUMN_MAP.websiteUrl])

  return {
    cafe_name:        cafeName,
    city,
    country,
    serves_matcha:    parseBool(row[COLUMN_MAP.servesMatcha]),
    instagram_url:    instagramUrl,
    website_url:      websiteUrl,
    platform_used:    row[COLUMN_MAP.platform]?.trim() || null,
    date_generated:   parseDate(row[COLUMN_MAP.dateGenerated]),
    contact_person:   row[COLUMN_MAP.contactPerson]?.trim() || null,
    date_contacted:   parseDate(row[COLUMN_MAP.dateContacted]),
    source_region:    region,
    last_imported_at: new Date().toISOString(),
    // Computed keys for dedupe (stripped from the upsert payload below)
    _normInstagram:   instagramUrl,
    _normWebsite:     websiteUrl,
    _normNameLoc:     normaliseName(cafeName) + '|' + normaliseName(rawLocation),
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin' && profile?.role !== 'lead_gen') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const sheetId = process.env.LEADS_GOOGLE_SHEET_ID
  const serviceAccountKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY

  if (!sheetId || !serviceAccountKeyRaw) {
    return NextResponse.json(
      { error: 'LEADS_GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_KEY env vars are required' },
      { status: 500 },
    )
  }

  if (LEAD_TABS.length === 0) {
    return NextResponse.json(
      { error: 'LEADS_SHEET_TABS env var is required (comma-separated tab names)' },
      { status: 500 },
    )
  }

  try {
    // -- 1. Authenticate with Google
    const credentials = JSON.parse(serviceAccountKeyRaw)
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
    const client = await auth.getClient()
    const tokenObj = await client.getAccessToken()
    if (!tokenObj.token) throw new Error('Failed to get Google access token')
    const token = tokenObj.token

    // -- 2. Fetch all tabs and merge into a single list of lead records
    const allLeads: LeadRecord[] = []
    const byRegion: Record<string, number> = {}

    for (const tab of LEAD_TABS) {
      const rows = await fetchTabRows(token, sheetId, tab)
      const mapped = rows
        .map((r) => rowToLead(r, tab))
        .filter((r): r is LeadRecord => r !== null)
      allLeads.push(...mapped)
      byRegion[tab] = mapped.length
    }

    if (allLeads.length === 0) {
      return NextResponse.json({ message: 'No valid rows found across all tabs', imported: 0, updated: 0 })
    }

    // -- 3. Load existing leads once for in-memory dedupe
    //    Fetch only the fields needed for matching + the customer_id
    const service = createServiceClient()
    const { data: existingLeads, error: fetchErr } = await service
      .from('customers')
      .select('customer_id, instagram_url, website_url, cafe_name, city, country')
      .eq('status', 'lead')

    if (fetchErr) throw new Error(fetchErr.message)

    // Build lookup maps
    const byInstagram = new Map<string, string>() // normUrl → customer_id
    const byWebsite   = new Map<string, string>()
    const byNameLoc   = new Map<string, string>()

    for (const c of existingLeads ?? []) {
      if (c.instagram_url) byInstagram.set(c.instagram_url, c.customer_id)
      if (c.website_url)   byWebsite.set(c.website_url, c.customer_id)
      const nameLoc = normaliseName(c.cafe_name) + '|' + normaliseName(
        [c.city, c.country].filter(Boolean).join(', ')
      )
      byNameLoc.set(nameLoc, c.customer_id)
    }

    // -- 4. Classify each row as insert or update
    const toInsert: Record<string, unknown>[] = []
    const toUpdate: Array<{ id: string; data: Record<string, unknown> }> = []

    // Sheet-importable fields (never include CRM workflow fields)
    const sheetFields = (lead: LeadRecord) => ({
      cafe_name:        lead.cafe_name,
      city:             lead.city,
      country:          lead.country,
      serves_matcha:    lead.serves_matcha,
      instagram_url:    lead.instagram_url,
      website_url:      lead.website_url,
      platform_used:    lead.platform_used,
      date_generated:   lead.date_generated,
      contact_person:   lead.contact_person,
      date_contacted:   lead.date_contacted,
      source_region:    lead.source_region,
      last_imported_at: lead.last_imported_at,
    })

    for (const lead of allLeads) {
      // Dedupe priority: instagram_url → website_url → name+location
      const existingId =
        (lead._normInstagram ? byInstagram.get(lead._normInstagram) : undefined) ??
        (lead._normWebsite   ? byWebsite.get(lead._normWebsite)     : undefined) ??
        byNameLoc.get(lead._normNameLoc)

      if (existingId) {
        toUpdate.push({ id: existingId, data: sheetFields(lead) })
      } else {
        toInsert.push({
          ...sheetFields(lead),
          status:     'lead',
          lead_stage: 'new_lead',
          is_outbound: true,
          lead_source: 'sheets_import',
        })
      }
    }

    // -- 5. Execute inserts and updates
    let imported = 0
    let updated  = 0
    const errors: string[] = []

    if (toInsert.length > 0) {
      const { error: insertErr, count } = await service
        .from('customers')
        .insert(toInsert as never, { count: 'exact' })
      if (insertErr) errors.push(`Insert error: ${insertErr.message}`)
      else imported = count ?? toInsert.length
    }

    // Update in batches of 50 to avoid query limits
    for (const { id, data } of toUpdate) {
      const { error: updateErr } = await service
        .from('customers')
        .update(data as never)
        .eq('customer_id', id)
      if (updateErr) errors.push(`Update ${id}: ${updateErr.message}`)
      else updated++
    }

    return NextResponse.json({
      success: true,
      imported,
      updated,
      skipped: allLeads.length - imported - updated,
      errors: errors.length > 0 ? errors : undefined,
      by_region: byRegion,
      synced_at: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
