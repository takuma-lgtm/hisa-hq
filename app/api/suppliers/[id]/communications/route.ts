import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('supplier_communications')
    .select('*, created_by_profile:profiles!supplier_communications_created_by_fkey(name)')
    .eq('supplier_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    // Fallback without profile join if FK name differs
    const { data: fallback, error: err2 } = await service
      .from('supplier_communications')
      .select('*')
      .eq('supplier_id', id)
      .order('created_at', { ascending: false })
    if (err2) return NextResponse.json({ error: err2.message }, { status: 500 })
    return NextResponse.json(fallback ?? [])
  }

  return NextResponse.json(data ?? [])
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
  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const body = await request.json()
  if (!body.channel) {
    return NextResponse.json({ error: 'channel is required' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('supplier_communications')
    .insert({
      supplier_id: id,
      channel: body.channel,
      direction: body.direction ?? 'outbound',
      subject: body.subject ?? null,
      message_body: body.message_body ?? null,
      notes: body.notes ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Update supplier's last_contacted_at
  await service
    .from('suppliers')
    .update({ last_contacted_at: new Date().toISOString() })
    .eq('supplier_id', id)

  return NextResponse.json(data, { status: 201 })
}
