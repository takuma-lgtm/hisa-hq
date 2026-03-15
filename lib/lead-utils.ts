// =============================================================================
// Shared lead-import helpers — used by both sheets-import and paste-import
// =============================================================================

/** Strip protocol, www, and trailing slashes for dedupe comparison. */
export function normaliseUrl(raw: string | undefined | null): string | null {
  if (!raw?.trim()) return null
  return raw
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/+$/, '')
}

/** Lowercase + strip punctuation for cafe name fuzzy matching. */
export function normaliseName(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

export function parseBool(raw: string | undefined | null): boolean | null {
  if (!raw?.trim()) return null
  return ['yes', 'true', '1', 'y'].includes(raw.toLowerCase().trim())
}

export function parseDate(raw: string | undefined | null): string | null {
  if (!raw?.trim()) return null
  const d = new Date(raw.trim())
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Region auto-detection from location string
// ---------------------------------------------------------------------------

const REGION_MAP: Record<string, string> = {
  // North America
  'usa': 'United States',
  'us': 'United States',
  'united states': 'United States',
  'america': 'United States',
  'canada': 'Canada',

  // Europe
  'uk': 'Europe',
  'united kingdom': 'Europe',
  'england': 'Europe',
  'scotland': 'Europe',
  'wales': 'Europe',
  'ireland': 'Europe',
  'france': 'Europe',
  'germany': 'Europe',
  'spain': 'Europe',
  'italy': 'Europe',
  'netherlands': 'Europe',
  'belgium': 'Europe',
  'sweden': 'Europe',
  'norway': 'Europe',
  'denmark': 'Europe',
  'finland': 'Europe',
  'portugal': 'Europe',
  'austria': 'Europe',
  'switzerland': 'Europe',
  'poland': 'Europe',
  'czech republic': 'Europe',
  'czechia': 'Europe',
  'greece': 'Europe',

  // Asia
  'japan': 'Asia',
  'thailand': 'Asia',
  'vietnam': 'Asia',
  'singapore': 'Asia',
  'malaysia': 'Asia',
  'indonesia': 'Asia',
  'philippines': 'Asia',
  'south korea': 'Asia',
  'korea': 'Asia',
  'taiwan': 'Asia',
  'china': 'Asia',
  'hong kong': 'Asia',
  'india': 'Asia',

  // Middle East
  'uae': 'Middle East',
  'dubai': 'Middle East',
  'saudi arabia': 'Middle East',
  'qatar': 'Middle East',
  'bahrain': 'Middle East',
  'kuwait': 'Middle East',

  // Oceania
  'australia': 'Oceania',
  'new zealand': 'Oceania',

  // ISO country codes (from Apify Google Maps results)
  'gb': 'Europe',
  'de': 'Europe',
  'fr': 'Europe',
  'es': 'Europe',
  'it': 'Europe',
  'nl': 'Europe',
  'be': 'Europe',
  'se': 'Europe',
  'no': 'Europe',
  'dk': 'Europe',
  'fi': 'Europe',
  'pt': 'Europe',
  'at': 'Europe',
  'ch': 'Europe',
  'pl': 'Europe',
  'cz': 'Europe',
  'gr': 'Europe',
  'ie': 'Europe',
  'jp': 'Asia',
  'th': 'Asia',
  'vn': 'Asia',
  'sg': 'Asia',
  'my': 'Asia',
  'id': 'Asia',
  'ph': 'Asia',
  'kr': 'Asia',
  'tw': 'Asia',
  'cn': 'Asia',
  'hk': 'Asia',
  'in': 'Asia',
  'ae': 'Middle East',
  'sa': 'Middle East',
  'qa': 'Middle East',
  'bh': 'Middle East',
  'kw': 'Middle East',
  'au': 'Oceania',
  'nz': 'Oceania',
  'ca': 'Canada',
}

/**
 * Detect region from a location string like "Portland, USA" or "Bangkok, Thailand".
 * Checks the last part (country) first, then the full string.
 * Falls back to the raw country portion or "Unknown".
 */
export function detectRegion(location: string): string {
  if (!location.trim()) return 'Unknown'

  const parts = location.split(',').map((s) => s.trim())
  // Check from last part (most likely country) to first
  for (let i = parts.length - 1; i >= 0; i--) {
    const key = parts[i].toLowerCase()
    if (REGION_MAP[key]) return REGION_MAP[key]
  }

  // Fallback: return last part as-is (likely the country name)
  return parts[parts.length - 1] || 'Unknown'
}
