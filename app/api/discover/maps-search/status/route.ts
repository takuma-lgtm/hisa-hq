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

  // Look up the discovery run
  const { data: run, error: runErr } = await service
    .from('discovery_runs')
    .select('*')
    .eq('run_id', runId)
    .single()

  if (runErr || !run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

  // If already completed, return cached results
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

  // Check Apify run status
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

    // Fetch results from Apify dataset
    const datasetRes = await fetch(`${APIFY_BASE}/actor-runs/${run.apify_run_id}/dataset/items?token=${token}`)
    if (!datasetRes.ok) throw new Error('Failed to fetch dataset')
    const rawItems: Record<string, unknown>[] = await datasetRes.json()

    // Dedup: load existing leads
    const { data: existing } = await service
      .from('customers')
      .select('customer_id, instagram_url, website_url, cafe_name, city, country, google_place_id')

    const byPlaceId = new Set<string>()
    const byInstagram = new Set<string>()
    const byWebsite = new Set<string>()
    const byNameLoc = new Set<string>()

    for (const c of existing ?? []) {
      if (c.google_place_id) byPlaceId.add(c.google_place_id)
      if (c.instagram_url) byInstagram.add(normaliseUrl(c.instagram_url) ?? '')
      if (c.website_url) byWebsite.add(normaliseUrl(c.website_url) ?? '')
      byNameLoc.add(normaliseName(c.cafe_name) + '|' + normaliseName([c.city, c.country].filter(Boolean).join(', ')))
    }

    // Map and deduplicate within batch
    const seenPlaceIds = new Set<string>()
    const prospects: Record<string, unknown>[] = []
    let dupCount = 0

    for (const item of rawItems) {
      const cafeName = (item.title as string) ?? ''
      if (!cafeName) continue

      const placeId = (item.placeId as string) ?? ''
      if (placeId && seenPlaceIds.has(placeId)) continue
      if (placeId) seenPlaceIds.add(placeId)

      const instagrams = item.instagrams as string[] | undefined
      const igUrl = instagrams?.[0] ?? null
      const websiteUrl = (item.website as string) ?? null
      const city = (item.city as string) ?? null
      const state = (item.state as string) ?? null
      const country = (item.countryCode as string) ?? 'US'

      // Check duplicate
      let isDup = false
      let dupOf: string | null = null

      if (placeId && byPlaceId.has(placeId)) isDup = true
      else if (igUrl && byInstagram.has(normaliseUrl(igUrl) ?? '')) isDup = true
      else if (websiteUrl && byWebsite.has(normaliseUrl(websiteUrl) ?? '')) isDup = true
      else {
        const key = normaliseName(cafeName) + '|' + normaliseName([city, country].filter(Boolean).join(', '))
        if (byNameLoc.has(key)) isDup = true
      }

      if (isDup) {
        dupCount++
        // Find the matching customer_id
        const match = (existing ?? []).find(c => {
          if (placeId && c.google_place_id === placeId) return true
          if (igUrl && normaliseUrl(c.instagram_url) === normaliseUrl(igUrl)) return true
          if (websiteUrl && normaliseUrl(c.website_url) === normaliseUrl(websiteUrl)) return true
          return false
        })
        dupOf = match?.customer_id ?? null
      }

      prospects.push({
        run_id: runId,
        cafe_name: cafeName,
        city,
        state,
        country,
        instagram_url: igUrl,
        instagram_handle: igUrl ? igUrl.split('/').filter(Boolean).pop() ?? null : null,
        website_url: websiteUrl,
        phone: (item.phone as string) ?? null,
        address: (item.address as string) ?? null,
        rating: typeof item.totalScore === 'number' ? item.totalScore : null,
        review_count: typeof item.reviewsCount === 'number' ? item.reviewsCount : null,
        serves_matcha: 'Unsure',
        source: 'google_maps',
        raw_data: item,
        is_duplicate: isDup,
        duplicate_of: dupOf,
      })
    }

    // Insert prospects
    if (prospects.length > 0) {
      await service.from('discovered_prospects').insert(prospects)
    }

    // Update run
    await service.from('discovery_runs').update({
      status: 'completed',
      results_count: prospects.length,
      duplicates_skipped: dupCount,
      completed_at: new Date().toISOString(),
    }).eq('run_id', runId)

    // Fetch inserted prospects to return
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
