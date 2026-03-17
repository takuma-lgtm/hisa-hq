import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Clay API helpers
// ---------------------------------------------------------------------------

const CLAY_API_BASE = 'https://api.clay.com/v1'

interface ClayContact {
  name: string
  email: string | null
  title: string | null
  linkedinUrl: string | null
}

/**
 * Extract domain from a URL string.
 * "https://www.example.com/about" → "example.com"
 */
function extractDomain(urlStr: string): string {
  let cleaned = urlStr.trim()
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `https://${cleaned}`
  }
  try {
    const url = new URL(cleaned)
    return url.hostname.replace(/^www\./, '')
  } catch {
    // Fallback: strip protocol and path manually
    return cleaned
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split('?')[0]
  }
}

/**
 * Call Clay's enrichment API to find company info and contacts.
 * Uses Clay's person/company enrichment endpoints.
 */
async function clayEnrich(
  apiKey: string,
  domain: string,
): Promise<{ contacts: ClayContact[]; companySize?: string }> {
  // Step 1: Find and enrich company
  const companyRes = await fetch(`${CLAY_API_BASE}/companies/enrich`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ domain }),
  })

  let companySize: string | undefined

  if (companyRes.ok) {
    const companyData = await companyRes.json()
    companySize =
      companyData.headcount?.toString() ??
      companyData.company_size ??
      companyData.size ??
      undefined
  }

  // Step 2: Find contacts (owner/manager/decision-maker)
  const contactsRes = await fetch(`${CLAY_API_BASE}/people/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      domain,
      titles: ['owner', 'founder', 'manager', 'buyer', 'purchasing', 'director'],
      enrich_email: true,
      limit: 5,
    }),
  })

  if (!contactsRes.ok) {
    // If Clay's REST API doesn't match this shape, return empty
    // The frontend handles empty results gracefully
    const errText = await contactsRes.text()
    console.error(`Clay contacts search failed (${contactsRes.status}): ${errText}`)
    return { contacts: [], companySize }
  }

  const contactsData = await contactsRes.json()

  // Normalize response — adapt to Clay's actual response shape
  const contacts: ClayContact[] = []
  const items = Array.isArray(contactsData) ? contactsData : (contactsData.results ?? contactsData.people ?? contactsData.contacts ?? [])

  for (const item of items) {
    contacts.push({
      name: item.name ?? item.full_name ?? item.first_name
        ? `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim()
        : 'Unknown',
      email: item.email ?? item.work_email ?? null,
      title: item.title ?? item.job_title ?? item.position ?? null,
      linkedinUrl: item.linkedin_url ?? item.linkedin ?? null,
    })
  }

  return { contacts, companySize }
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
  const apiKey = process.env.CLAY_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'CLAY_API_KEY not configured' },
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

  const domain = extractDomain(body.websiteUrl)

  try {
    const result = await clayEnrich(apiKey, domain)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Clay enrichment error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
