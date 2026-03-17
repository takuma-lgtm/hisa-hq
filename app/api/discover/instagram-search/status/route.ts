import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { normaliseUrl, normaliseName } from '@/lib/lead-utils'

const APIFY_BASE = 'https://api.apify.com/v2'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const runId = searchParams.get('run_id')
  if (!runId) return NextResponse.json({ error: 'run_id required' }, { status: 400 })

  const token = process.env.APIFY_TOKEN
  if (!token) return NextResponse.json({ error: 'APIFY_TOKEN not configured' }, { status: 500 })

  const service = createServiceClient()

  const { data: run, error: runErr } = await service
    .from('discovery_runs')
    .select('*')
    .eq('run_id', runId)
    .single()

  if (runErr || !run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

  if (run.status === 'completed' || run.status === 'failed') {
    const { data: prospects } = await service
      .from('discovered_prospects')
      .select('*')
      .eq('run_id', runId)
      .order('created_at')

    return NextResponse.json({
      status: run.status,
      results_count: run.results_count,
      imported_count: run.imported_count,
      duplicates_count: run.duplicates_skipped,
      prospects: prospects ?? [],
    })
  }

  try {
    const apifyRes = await fetch(`${APIFY_BASE}/actor-runs/${run.apify_run_id}?token=${token}`)
    if (!apifyRes.ok) throw new Error(`Apify status check failed (${apifyRes.status})`)

    const apifyData = await apifyRes.json()
    const apifyStatus = apifyData.data.status as string

    if (!['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED'].includes(apifyStatus)) {
      return NextResponse.json({ status: 'running', results_count: 0, prospects: [] })
    }

    if (apifyStatus !== 'SUCCEEDED') {
      await service.from('discovery_runs').update({
        status: 'failed',
        error_message: `Apify run ${apifyStatus.toLowerCase()}`,
        completed_at: new Date().toISOString(),
      }).eq('run_id', runId)

      return NextResponse.json({ status: 'failed', error: `Apify run ${apifyStatus.toLowerCase()}` })
    }

    // Fetch Instagram results
    const datasetRes = await fetch(`${APIFY_BASE}/actor-runs/${run.apify_run_id}/dataset/items?token=${token}`)
    if (!datasetRes.ok) throw new Error('Failed to fetch dataset')
    const rawItems: Record<string, unknown>[] = await datasetRes.json()

    // Load existing leads for dedup
    const { data: existing } = await service
      .from('customers')
      .select('customer_id, instagram_url, website_url, cafe_name, city, country')

    const byInstagram = new Set<string>()
    const byWebsite = new Set<string>()
    const byNameLoc = new Set<string>()

    for (const c of existing ?? []) {
      if (c.instagram_url) byInstagram.add(normaliseUrl(c.instagram_url) ?? '')
      if (c.website_url) byWebsite.add(normaliseUrl(c.website_url) ?? '')
      byNameLoc.add(normaliseName(c.cafe_name) + '|' + normaliseName([c.city, c.country].filter(Boolean).join(', ')))
    }

    // Parse Instagram posts/profiles → prospects
    const seenHandles = new Set<string>()
    const prospects: Record<string, unknown>[] = []
    let dupCount = 0

    for (const item of rawItems) {
      // Instagram scraper returns posts — extract the profile info
      const ownerUsername = (item.ownerUsername as string) ?? (item.username as string) ?? ''
      if (!ownerUsername || seenHandles.has(ownerUsername)) continue
      seenHandles.add(ownerUsername)

      const displayName = (item.ownerFullName as string) ?? (item.fullName as string) ?? ownerUsername
      const igUrl = `https://instagram.com/${ownerUsername}`
      const bio = (item.biography as string) ?? ''
      const externalUrl = (item.externalUrl as string) ?? (item.website as string) ?? null
      const locationName = (item.locationName as string) ?? null

      // Check if it looks like a business (café/coffee)
      const bioLower = (bio + ' ' + displayName).toLowerCase()
      const isCafe = /caf[eé]|coffee|tea|matcha|espresso|roast|brew/i.test(bioLower)
      if (!isCafe) continue

      // Determine matcha relevance from hashtags
      const hashtags = (item.hashtags as string[]) ?? []
      const matchaRelated = hashtags.some(h => /matcha/i.test(h))

      // Check duplicate
      let isDup = false
      let dupOf: string | null = null
      const normIg = normaliseUrl(igUrl)
      if (normIg && byInstagram.has(normIg)) {
        isDup = true
        dupOf = (existing ?? []).find(c => normaliseUrl(c.instagram_url) === normIg)?.customer_id ?? null
      }

      if (isDup) dupCount++

      prospects.push({
        run_id: runId,
        cafe_name: displayName,
        city: locationName,
        country: 'US',
        instagram_url: igUrl,
        instagram_handle: ownerUsername,
        website_url: externalUrl,
        serves_matcha: matchaRelated ? 'Yes' : 'Unsure',
        source: 'instagram',
        raw_data: item,
        is_duplicate: isDup,
        duplicate_of: dupOf,
      })
    }

    if (prospects.length > 0) {
      await service.from('discovered_prospects').insert(prospects)
    }

    await service.from('discovery_runs').update({
      status: 'completed',
      results_count: prospects.length,
      duplicates_skipped: dupCount,
      completed_at: new Date().toISOString(),
    }).eq('run_id', runId)

    const { data: savedProspects } = await service
      .from('discovered_prospects')
      .select('*')
      .eq('run_id', runId)
      .order('created_at')

    return NextResponse.json({
      status: 'completed',
      results_count: prospects.length,
      duplicates_count: dupCount,
      prospects: savedProspects ?? [],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await service.from('discovery_runs').update({
      status: 'failed',
      error_message: message,
      completed_at: new Date().toISOString(),
    }).eq('run_id', runId)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
