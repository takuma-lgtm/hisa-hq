import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { detectRegion } from '@/lib/lead-utils'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  let body: { run_id: string; skip_duplicates?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { run_id, skip_duplicates = true } = body
  if (!run_id) return NextResponse.json({ error: 'run_id is required' }, { status: 400 })

  const service = createServiceClient()

  try {
    const { data: prospects, error: fetchErr } = await service
      .from('discovered_prospects')
      .select('*')
      .eq('run_id', run_id)
      .eq('imported', false)

    if (fetchErr) throw new Error(fetchErr.message)
    if (!prospects || prospects.length === 0) {
      return NextResponse.json({ imported: 0, skipped: 0 })
    }

    const toImport = skip_duplicates
      ? prospects.filter((p: Record<string, unknown>) => !p.is_duplicate)
      : prospects

    const skipped = prospects.length - toImport.length
    const today = new Date().toISOString().split('T')[0]
    let importedCount = 0

    for (const p of toImport) {
      const pr = p as Record<string, unknown>
      const locationStr = [pr.city, pr.state, pr.country].filter(Boolean).join(', ')
      const matchaVal = pr.serves_matcha === 'Yes' ? true : pr.serves_matcha === 'No' ? false : null

      const { error: insertErr } = await service.from('customers').insert({
        cafe_name: pr.cafe_name as string,
        status: 'lead',
        lead_stage: 'new_lead',
        city: (pr.city as string) ?? null,
        country: (pr.country as string) ?? 'US',
        instagram_url: (pr.instagram_url as string) ?? null,
        website_url: (pr.website_url as string) ?? null,
        serves_matcha: matchaVal,
        date_generated: today,
        source_region: detectRegion(locationStr),
        lead_source: `discover_${pr.source}`,
        is_outbound: true,
        notes: `Discovered via ${pr.source} search`,
      })

      if (!insertErr) {
        importedCount++
        await service.from('discovered_prospects').update({
          imported: true,
          imported_at: new Date().toISOString(),
        }).eq('prospect_id', pr.prospect_id as string)
      }
    }

    await service.from('discovery_runs').update({
      imported_count: importedCount,
      duplicates_skipped: skipped,
    }).eq('run_id', run_id)

    return NextResponse.json({ imported: importedCount, skipped })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
