import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { MessageChannel } from '@/types/database'

const VALID_CHANNELS = new Set<MessageChannel>(['instagram_dm', 'email', 'whatsapp'])

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('instagram_logs')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: data })
}

export async function POST(
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

  const messageSent = body.message_sent as string | undefined
  const channel = body.channel as string | undefined
  const notes = body.notes as string | undefined

  if (!messageSent || messageSent.trim().length === 0) {
    return NextResponse.json({ error: 'message_sent is required' }, { status: 400 })
  }
  if (!channel || !VALID_CHANNELS.has(channel as MessageChannel)) {
    return NextResponse.json({ error: 'channel must be instagram_dm, email, or whatsapp' }, { status: 400 })
  }

  const service = createServiceClient()

  // Insert the message log
  const { data: log, error: logError } = await service
    .from('instagram_logs')
    .insert({
      customer_id: id,
      message_sent: messageSent.trim(),
      channel,
      status: 'no_response',
      notes: notes?.trim() || null,
    })
    .select()
    .single()

  if (logError) return NextResponse.json({ error: logError.message }, { status: 500 })

  // Auto-update date_contacted and auto-advance lead_stage
  const { data: customer } = await service
    .from('customers')
    .select('lead_stage')
    .eq('customer_id', id)
    .single()

  const updates: Record<string, unknown> = {
    date_contacted: new Date().toISOString(),
  }

  if (customer?.lead_stage === 'new_lead') {
    updates.lead_stage = 'contacted'
  }

  await service
    .from('customers')
    .update(updates)
    .eq('customer_id', id)

  return NextResponse.json({ success: true, message: log })
}
