// FedEx Track API v1 client
// Docs: https://developer.fedex.com/api/en-us/catalog/track/v1/docs.html

export interface TrackingResult {
  trackingNumber: string
  status: 'in_transit' | 'delivered' | 'exception' | 'unknown'
  statusDetail: string
  estimatedDelivery: string | null
  actualDelivery: string | null
  lastUpdate: string
  lastLocation: string | null
  trackingUrl: string
  rawEvents: TrackingEvent[]
}

export interface TrackingEvent {
  timestamp: string
  status: string
  description: string
  location: string | null
}

// ---------------------------------------------------------------------------
// OAuth2 token cache
// ---------------------------------------------------------------------------

let cachedToken: { access_token: string; expires_at: number } | null = null

const FEDEX_API_URL = process.env.FEDEX_API_URL || 'https://apis.fedex.com'

export async function getFedExToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at) {
    return cachedToken.access_token
  }

  const clientId = process.env.FEDEX_API_KEY
  const clientSecret = process.env.FEDEX_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('FEDEX_API_KEY and FEDEX_CLIENT_SECRET must be set')
  }

  const res = await fetch(`${FEDEX_API_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`FedEx OAuth failed (${res.status}): ${text}`)
  }

  const json = await res.json()
  cachedToken = {
    access_token: json.access_token,
    // Expire 60 seconds early to avoid edge-case failures
    expires_at: Date.now() + (json.expires_in - 60) * 1000,
  }

  return cachedToken.access_token
}

// ---------------------------------------------------------------------------
// Status code mapping
// ---------------------------------------------------------------------------

function mapFedExStatus(code: string): TrackingResult['status'] {
  switch (code) {
    case 'DL':
      return 'delivered'
    case 'IT':
    case 'DP':
    case 'AR':
    case 'OD':
    case 'PU':
      return 'in_transit'
    case 'DE':
    case 'CA':
    case 'SE':
      return 'exception'
    default:
      return 'unknown'
  }
}

function buildTrackingUrl(trackingNumber: string): string {
  return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`
}

// ---------------------------------------------------------------------------
// Track a package — never throws
// ---------------------------------------------------------------------------

export async function trackPackage(trackingNumber: string): Promise<TrackingResult> {
  const empty: TrackingResult = {
    trackingNumber,
    status: 'unknown',
    statusDetail: '',
    estimatedDelivery: null,
    actualDelivery: null,
    lastUpdate: new Date().toISOString(),
    lastLocation: null,
    trackingUrl: buildTrackingUrl(trackingNumber),
    rawEvents: [],
  }

  try {
    const token = await getFedExToken()

    const res = await fetch(`${FEDEX_API_URL}/track/v1/trackingnumbers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        includeDetailedScans: true,
        trackingInfo: [
          { trackingNumberInfo: { trackingNumber } },
        ],
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return { ...empty, statusDetail: `FedEx API error (${res.status}): ${text}` }
    }

    const json = await res.json()
    const trackResult = json?.output?.completeTrackResults?.[0]?.trackResults?.[0]
    if (!trackResult) {
      return { ...empty, statusDetail: 'No tracking results returned by FedEx' }
    }

    // Status
    const latestStatus = trackResult.latestStatusDetail
    const statusCode = latestStatus?.code ?? ''
    const statusByLocale = latestStatus?.statusByLocale ?? latestStatus?.description ?? 'Unknown'

    // Dates
    const dates: Record<string, string> = {}
    for (const dt of trackResult.dateAndTimes ?? []) {
      if (dt.type && dt.dateTime) dates[dt.type] = dt.dateTime
    }

    // Scan events
    const rawEvents: TrackingEvent[] = (trackResult.scanEvents ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ev: any) => ({
        timestamp: ev.date ?? '',
        status: ev.eventType ?? '',
        description: ev.eventDescription ?? '',
        location: ev.scanLocation
          ? [ev.scanLocation.city, ev.scanLocation.stateOrProvinceCode, ev.scanLocation.countryCode]
              .filter(Boolean)
              .join(', ')
          : null,
      }),
    )

    const lastEvent = rawEvents[0]

    return {
      trackingNumber,
      status: mapFedExStatus(statusCode),
      statusDetail: statusByLocale,
      estimatedDelivery: dates['ESTIMATED_DELIVERY'] ?? null,
      actualDelivery: dates['ACTUAL_DELIVERY'] ?? null,
      lastUpdate: lastEvent?.timestamp ?? new Date().toISOString(),
      lastLocation: lastEvent?.location ?? null,
      trackingUrl: buildTrackingUrl(trackingNumber),
      rawEvents,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error tracking package'
    return { ...empty, statusDetail: message }
  }
}
