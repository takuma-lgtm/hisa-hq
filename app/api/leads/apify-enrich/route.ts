import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Apify REST API helpers (same pattern as apify-search)
// ---------------------------------------------------------------------------

const APIFY_BASE = 'https://api.apify.com/v2'
const ACTOR_ID = 'vdrmota~contact-info-scraper'
const POLL_INTERVAL_MS = 3_000
const MAX_POLLS = 40 // 120 seconds max (contact scraping can be slower)

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
// Extract contact info from dataset items
// ---------------------------------------------------------------------------

function extractContacts(items: Record<string, unknown>[]) {
  const emails = new Set<string>()
  const phones = new Set<string>()
  const socialUrls = new Set<string>()

  for (const item of items) {
    // Emails
    if (Array.isArray(item.emails)) {
      for (const e of item.emails) {
        if (typeof e === 'string' && e.includes('@')) emails.add(e.toLowerCase().trim())
      }
    }

    // Phones
    if (Array.isArray(item.phones)) {
      for (const p of item.phones) {
        if (typeof p === 'string' && p.trim()) phones.add(p.trim())
      }
    }

    // Social URLs (Facebook, Instagram, Twitter, LinkedIn, etc.)
    for (const key of ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok', 'pinterest']) {
      const val = item[key]
      if (typeof val === 'string' && val.trim()) {
        socialUrls.add(val.trim())
      }
    }

    // Some scrapers return socialLinks array
    if (Array.isArray(item.socialLinks)) {
      for (const link of item.socialLinks) {
        if (typeof link === 'string' && link.trim()) socialUrls.add(link.trim())
      }
    }
  }

  return {
    emails: [...emails],
    phones: [...phones],
    socialUrls: [...socialUrls],
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // Auth
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

  if (!profile) {
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
  let body: { customerId: string; websiteUrl: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.customerId || !body.websiteUrl?.trim()) {
    return NextResponse.json(
      { error: 'customerId and websiteUrl are required' },
      { status: 400 },
    )
  }

  // Ensure URL has protocol
  let url = body.websiteUrl.trim()
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`
  }

  try {
    const runId = await startRun(token, {
      startUrls: [{ url }],
      maxRequestsPerStartUrl: 20,
    })

    const status = await pollRun(token, runId)

    if (status !== 'SUCCEEDED') {
      return NextResponse.json(
        { error: `Enrichment ${status.toLowerCase()}. The website may be unreachable.` },
        { status: 502 },
      )
    }

    const raw = await fetchDataset(token, runId)
    const contacts = extractContacts(raw)

    return NextResponse.json(contacts)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
