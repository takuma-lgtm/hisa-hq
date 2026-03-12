import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: opportunityId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('call_logs')
    .select('*, logged_by_profile:profiles!call_logs_logged_by_fkey(name)')
    .eq('opportunity_id', opportunityId)
    .order('called_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ callLogs: data })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: opportunityId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    customer_id,
    call_type,
    called_at,
    duration_minutes,
    spoke_with_role,
    spoke_with_name,
    outcome,
    raw_summary,
    ext_current_supplier,
    ext_current_price_per_kg,
    ext_likes,
    ext_dislikes,
    ext_why_switch,
    ext_definition_good_matcha,
    ext_additional_notes,
    intel_applied,
  } = body

  if (!customer_id) {
    return NextResponse.json({ error: 'customer_id is required' }, { status: 400 })
  }

  // Insert call log
  const { data: callLog, error } = await supabase
    .from('call_logs')
    .insert({
      opportunity_id: opportunityId,
      customer_id,
      logged_by: user.id,
      call_type: call_type ?? 'general',
      called_at: called_at ?? new Date().toISOString(),
      duration_minutes: duration_minutes ?? null,
      spoke_with_role: spoke_with_role || null,
      spoke_with_name: spoke_with_name || null,
      outcome: outcome ?? 'follow_up',
      raw_summary: raw_summary || null,
      ext_current_supplier: ext_current_supplier || null,
      ext_current_price_per_kg: ext_current_price_per_kg ?? null,
      ext_likes: ext_likes || null,
      ext_dislikes: ext_dislikes || null,
      ext_why_switch: ext_why_switch || null,
      ext_definition_good_matcha: ext_definition_good_matcha || null,
      ext_additional_notes: ext_additional_notes || null,
      intel_applied: intel_applied ?? false,
    })
    .select('*, logged_by_profile:profiles!call_logs_logged_by_fkey(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If intel_applied, push extracted intel back to the customer record (only overwrite non-empty fields)
  if (intel_applied) {
    const updates: Record<string, unknown> = {}
    if (ext_current_supplier) updates.current_supplier = ext_current_supplier
    if (ext_current_price_per_kg != null) updates.current_delivered_price_per_kg = ext_current_price_per_kg
    if (ext_likes) updates.likes_about_current = ext_likes
    if (ext_dislikes) updates.dislikes_about_current = ext_dislikes
    if (ext_why_switch) updates.why_switch = ext_why_switch
    if (ext_definition_good_matcha) updates.definition_of_good_matcha = ext_definition_good_matcha

    if (Object.keys(updates).length > 0) {
      const service = createServiceClient()
      await service.from('customers').update(updates).eq('customer_id', customer_id)
    }
  }

  return NextResponse.json({ callLog })
}
