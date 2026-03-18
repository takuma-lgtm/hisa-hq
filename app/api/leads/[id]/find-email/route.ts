import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Gemini helpers
// ---------------------------------------------------------------------------

async function findEmailWithGemini(
  cafeName: string,
  city: string | null,
  country: string | null,
  websiteUrl: string | null,
): Promise<string[]> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY not configured')

  const locationParts = [city, country].filter(Boolean).join(', ')
  const websitePart = websiteUrl ? ` Their website is ${websiteUrl}.` : ''

  const prompt = `Find the public contact email address for a café called "${cafeName}"${locationParts ? ` located in ${locationParts}` : ''}.${websitePart} Search the web and their website. Return ONLY a JSON array of email addresses found, e.g. ["info@cafe.com"]. If none found, return []. Do not include any other text.`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
    },
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini API error (${res.status}): ${text}`)
  }

  const data = await res.json()
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  const match = text.match(/\[[\s\S]*?\]/)
  if (!match) return []

  try {
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((e): e is string => typeof e === 'string' && e.includes('@'))
      .map((e) => e.toLowerCase().trim())
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Apify fallback
// ---------------------------------------------------------------------------

const APIFY_BASE = 'https://api.apify.com/v2'
const ACTOR_ID = 'vdrmota~contact-info-scraper'

async function findEmailWithApify(websiteUrl: string): Promise<string[]> {
  const token = process.env.APIFY_TOKEN
  if (!token) return []

  let url = websiteUrl.trim()
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`

  const startRes = await fetch(`${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startUrls: [{ url }], maxRequestsPerStartUrl: 10 }),
  })
  if (!startRes.ok) return []
  const { data: runData } = await startRes.json()
  const runId: string = runData.id

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const pollRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`)
    if (!pollRes.ok) continue
    const { data: poll } = await pollRes.json()
    if (poll.status === 'SUCCEEDED') break
    if (['FAILED', 'TIMED-OUT', 'ABORTED'].includes(poll.status)) return []
  }

  const dataRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${token}`)
  if (!dataRes.ok) return []
  const items: Record<string, unknown>[] = await dataRes.json()

  const emails = new Set<string>()
  for (const item of items) {
    if (Array.isArray(item.emails)) {
      for (const e of item.emails) {
        if (typeof e === 'string' && e.includes('@')) emails.add(e.toLowerCase().trim())
      }
    }
  }
  return [...emails]
}

// ---------------------------------------------------------------------------
// SSE helper
// ---------------------------------------------------------------------------

function sseEvent(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
}

// ---------------------------------------------------------------------------
// Route handler — streams SSE progress events
// ---------------------------------------------------------------------------

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: lead, error } = await supabase
    .from('customers')
    .select('cafe_name, city, state, country, website_url')
    .eq('customer_id', id)
    .single()

  if (error || !lead) return new Response('Lead not found', { status: 404 })

  const { cafe_name, city, country, website_url } = lead

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Stage 1: Gemini
        controller.enqueue(sseEvent({ type: 'status', message: 'Searching the web with AI...' }))
        let geminiEmails: string[] = []
        try {
          geminiEmails = await findEmailWithGemini(cafe_name ?? '', city, country, website_url)
        } catch (err) {
          console.error('Gemini email search failed:', err)
        }

        if (geminiEmails.length > 0) {
          controller.enqueue(sseEvent({ type: 'result', emails: geminiEmails, source: 'gemini' }))
          controller.close()
          return
        }

        // Stage 2: Apify fallback
        if (website_url) {
          controller.enqueue(sseEvent({ type: 'status', message: 'No result via AI — checking the café website...' }))
          try {
            const apifyEmails = await findEmailWithApify(website_url)
            controller.enqueue(sseEvent({ type: 'result', emails: apifyEmails, source: apifyEmails.length > 0 ? 'apify' : null }))
          } catch (err) {
            console.error('Apify email search failed:', err)
            controller.enqueue(sseEvent({ type: 'result', emails: [], source: null }))
          }
        } else {
          controller.enqueue(sseEvent({ type: 'result', emails: [], source: null }))
        }
      } catch (err) {
        console.error('find-email stream error:', err)
        controller.enqueue(sseEvent({ type: 'result', emails: [], source: null }))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
