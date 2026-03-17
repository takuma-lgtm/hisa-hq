import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const APIFY_BASE = 'https://api.apify.com/v2'
const ACTOR_ID = 'apify~instagram-hashtag-scraper'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const token = process.env.APIFY_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'APIFY_TOKEN not configured' }, { status: 500 })
  }

  let body: { hashtags: string; location?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { hashtags, location } = body
  if (!hashtags?.trim()) {
    return NextResponse.json({ error: 'hashtags is required' }, { status: 400 })
  }

  const service = createServiceClient()

  try {
    const hashtagList = hashtags.split(',').map(h => h.trim().replace(/^#/, ''))

    // Start Apify run (non-blocking)
    const res = await fetch(`${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hashtags: hashtagList,
        resultsLimit: 100,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Apify start failed (${res.status}): ${text}`)
    }

    const data = await res.json()
    const apifyRunId = data.data.id as string

    const insertData = {
      source: 'instagram',
      status: 'running',
      params: { hashtags, location: location ?? null },
      apify_run_id: apifyRunId,
      created_by: user.id,
    }
    const { data: run, error: insertErr } = await service
      .from('discovery_runs')
      .insert(insertData as Record<string, unknown>)
      .select('run_id')
      .single()

    if (insertErr) throw new Error(insertErr.message)

    return NextResponse.json({
      run_id: run.run_id,
      apify_run_id: apifyRunId,
      status: 'running',
    }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
