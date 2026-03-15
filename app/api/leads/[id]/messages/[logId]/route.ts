import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const VALID_STATUSES = new Set(['no_response', 'replied', 'interested', 'not_interested'])
const ALLOWED_FIELDS = new Set(['status', 'reply_received', 'notes'])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; logId: string }> },
) {
  const { id, logId } = await params

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

  const patch: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_FIELDS.has(key)) continue

    if (key === 'status' && !VALID_STATUSES.has(value as string)) {
      return NextResponse.json({ error: `Invalid status: ${value}` }, { status: 400 })
    }

    patch[key] = value ?? null
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: log, error } = await service
    .from('instagram_logs')
    .update(patch)
    .eq('log_id', logId)
    .eq('customer_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!log) return NextResponse.json({ error: 'Message not found' }, { status: 404 })

  // Auto-advance lead_stage if reply received
  const newStatus = patch.status as string | undefined
  if (newStatus === 'replied' || newStatus === 'interested') {
    const { data: customer } = await service
      .from('customers')
      .select('lead_stage')
      .eq('customer_id', id)
      .single()

    if (customer?.lead_stage === 'contacted') {
      await service
        .from('customers')
        .update({ lead_stage: 'replied' })
        .eq('customer_id', id)
    }
  }

  return NextResponse.json({ success: true, message: log })
}
