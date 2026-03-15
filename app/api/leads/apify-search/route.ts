import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestBody {
  query: string
  location: string
  maxResults?: number
  scrapeContacts?: boolean
}

export interface ApifySearchResult {
  place_id: string
  cafe_name: string
  address: string
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  phone: string | null
  website_url: string | null
  email: string | null
  instagram_url: string | null
  google_rating: number | null
  google_review_count: number | null
  category: string | null
}

// ---------------------------------------------------------------------------
// Apify REST API helpers
// ---------------------------------------------------------------------------

const APIFY_BASE = 'https://api.apify.com/v2'
const ACTOR_ID = 'compass~crawler-google-places'
const POLL_INTERVAL_MS = 3_000
const MAX_POLLS = 30 // 90 seconds max

async function startRun(
  token: string,
  input: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(`${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Apify start failed (${res.status}): ${text}`)
  }
  const data = await res.json()
  return data.data.id as string
}

async function pollRun(
  token: string,
  runId: string,
): Promise<'SUCCEEDED' | 'FAILED' | 'TIMED-OUT' | 'ABORTED'> {
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`)
    if (!res.ok) continue
    const data = await res.json()
    const status = data.data.status as string
    if (['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED'].includes(status)) {
      return status as 'SUCCEEDED' | 'FAILED' | 'TIMED-OUT' | 'ABORTED'
    }
  }
  return 'TIMED-OUT'
}

async function fetchDataset(
  token: string,
  runId: string,
): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${token}`,
  )
  if (!res.ok) throw new Error(`Failed to fetch dataset (${res.status})`)
  return res.json()
}

// ---------------------------------------------------------------------------
// Map Apify result to our schema
// ---------------------------------------------------------------------------

function mapResult(item: Record<string, unknown>): ApifySearchResult {
  const emails = item.emails as string[] | undefined
  const instagrams = item.instagrams as string[] | undefined

  return {
    place_id: (item.placeId as string) ?? '',
    cafe_name: (item.title as string) ?? '',
    address: (item.address as string) ?? '',
    city: (item.city as string) ?? null,
    state: (item.state as string) ?? null,
    zip_code: (item.postalCode as string) ?? null,
    country: (item.countryCode as string) ?? null,
    phone: (item.phone as string) ?? null,
    website_url: (item.website as string) ?? null,
    email: emails?.[0] ?? null,
    instagram_url: instagrams?.[0] ?? null,
    google_rating: typeof item.totalScore === 'number' ? item.totalScore : null,
    google_review_count:
      typeof item.reviewsCount === 'number' ? item.reviewsCount : null,
    category: (item.categoryName as string) ?? null,
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'lead_gen') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Validate env
  const token = process.env.APIFY_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: 'APIFY_TOKEN not configured' },
      { status: 500 },
    )
  }

  // Parse body
  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { query, location, scrapeContacts } = body
  if (!query?.trim() || !location?.trim()) {
    return NextResponse.json(
      { error: 'query and location are required' },
      { status: 400 },
    )
  }

  const maxResults = Math.min(Math.max(body.maxResults ?? 20, 1), 100)

  try {
    // Start Apify actor run
    const runId = await startRun(token, {
      searchStringsArray: [query.trim()],
      locationQuery: location.trim(),
      maxCrawledPlacesPerSearch: maxResults,
      language: 'en',
      ...(scrapeContacts ? { scrapeContacts: true } : {}),
    })

    // Poll for completion
    const status = await pollRun(token, runId)

    if (status !== 'SUCCEEDED') {
      return NextResponse.json(
        { error: `Apify run ${status.toLowerCase()}. Try again or reduce maxResults.` },
        { status: 502 },
      )
    }

    // Fetch and map results
    const raw = await fetchDataset(token, runId)
    const results = raw.map(mapResult).filter((r) => r.cafe_name)

    return NextResponse.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
