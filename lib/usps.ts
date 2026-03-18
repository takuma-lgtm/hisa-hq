// USPS Tracking API v3 (REST/JSON)
// Docs: https://developer.usps.com/api/tracking
// Requires USPS_CLIENT_ID + USPS_CLIENT_SECRET (OAuth2 client credentials)

export interface TrackingResult {
  trackingNumber: string
  status: 'in_transit' | 'delivered' | 'exception' | 'unknown'
  statusDetail: string
  estimatedDelivery: string | null
  actualDelivery: string | null
  lastUpdate: string
  lastLocation: string | null
  trackingUrl: string
}

const USPS_BASE = 'https://api.usps.com'

// Simple in-process token cache (cleared on cold start, fine for serverless)
let cachedToken: { value: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value

  const clientId = process.env.USPS_CLIENT_ID
  const clientSecret = process.env.USPS_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('USPS_CLIENT_ID and USPS_CLIENT_SECRET must be set')
  }

  const res = await fetch(`${USPS_BASE}/oauth2/v3/token`, {
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
    throw new Error(`USPS OAuth error ${res.status}: ${text}`)
  }

  const data = await res.json()
  // expires_in is in seconds; subtract 60s buffer
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }
  return cachedToken.value
}

function parseStatusCategory(
  category: string,
  eventCode: string,
): 'in_transit' | 'delivered' | 'exception' | 'unknown' {
  const c = (category ?? '').toUpperCase()
  const e = (eventCode ?? '').toUpperCase()

  if (c === 'DELIVERED' || e === 'DL') return 'delivered'
  if (c === 'DELIVERY_ATTEMPT' || c === 'UNDELIVERABLE' || c === 'RETURN_TO_SENDER') return 'exception'
  if (
    c === 'IN_TRANSIT' || c === 'OUT_FOR_DELIVERY' || c === 'ACCEPTED' ||
    c === 'USPS_IN_POSSESSION' || c === 'DEPARTED' || c === 'ARRIVED'
  ) return 'in_transit'

  // Fallback: scan event code prefixes
  if (e.startsWith('D')) return 'delivered'
  if (e.startsWith('X') || e.startsWith('N')) return 'exception'
  if (e.startsWith('T') || e.startsWith('A') || e.startsWith('L')) return 'in_transit'

  return 'unknown'
}

export async function trackUspsPackage(trackingNumber: string): Promise<TrackingResult> {
  const token = await getAccessToken()

  const res = await fetch(
    `${USPS_BASE}/tracking/v3/tracking/${encodeURIComponent(trackingNumber)}?expand=DETAIL`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`USPS tracking error ${res.status}: ${text}`)
  }

  const data = await res.json()

  // Top-level summary fields
  const summary = data.TrackSummary ?? data.trackSummary ?? {}
  const events: Record<string, string>[] = data.TrackDetail ?? data.trackDetail ?? []

  // Most recent event is the summary; fall back to first detail event
  const latest = Object.keys(summary).length > 0 ? summary : events[0] ?? {}

  const eventCategory: string = latest.EventStatusCategory ?? latest.eventStatusCategory ?? ''
  const eventCode: string = latest.EventCode ?? latest.eventCode ?? ''
  const eventDesc: string = latest.Event ?? latest.event ?? latest.EventDescription ?? latest.eventDescription ?? 'No status available'
  const eventDate: string = latest.EventDate ?? latest.eventDate ?? ''
  const eventTime: string = latest.EventTime ?? latest.eventTime ?? ''
  const city: string = latest.EventCity ?? latest.eventCity ?? ''
  const state: string = latest.EventState ?? latest.eventState ?? ''

  // Estimated delivery from top-level field
  const edd: string | null =
    data.ExpectedDeliveryDate ?? data.expectedDeliveryDate ??
    data.PredictedDeliveryDate ?? data.predictedDeliveryDate ?? null

  const status = parseStatusCategory(eventCategory, eventCode)
  const lastUpdate = [eventDate, eventTime].filter(Boolean).join(' ')
  const location = [city, state].filter(Boolean).join(', ') || null

  return {
    trackingNumber,
    status,
    statusDetail: eventDesc,
    estimatedDelivery: edd,
    actualDelivery: status === 'delivered' ? (eventDate || new Date().toISOString().split('T')[0]) : null,
    lastUpdate,
    lastLocation: location,
    trackingUrl: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
  }
}
