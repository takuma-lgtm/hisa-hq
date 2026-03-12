import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { LeadStage } from '@/types/database'

// Only these fields may be updated via this endpoint (CRM-managed)
const ALLOWED_FIELDS = new Set(['lead_stage', 'lead_assigned_to', 'notes'])

const VALID_STAGES = new Set<LeadStage>([
  'new_lead', 'contacted', 'replied', 'qualified', 'handed_off', 'disqualified',
])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin' && profile?.role !== 'lead_gen') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Whitelist enforcement — only CRM-managed fields allowed
  const patch: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_FIELDS.has(key)) continue

    if (key === 'lead_stage') {
      if (value !== null && !VALID_STAGES.has(value as LeadStage)) {
        return NextResponse.json({ error: `Invalid lead_stage value: ${value}` }, { status: 400 })
      }
    }

    patch[key] = value ?? null
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('customers')
    .update(patch as never)
    .eq('customer_id', id)
    .eq('status', 'lead')
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  return NextResponse.json({ success: true, customer: data })
}
