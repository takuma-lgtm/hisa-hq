import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const service = createServiceClient()

  const update: Record<string, unknown> = {}
  if (body.status) {
    update.status = body.status
    if (body.status === 'done') update.completed_at = new Date().toISOString()
  }
  if (body.assigned_to !== undefined) update.assigned_to = body.assigned_to

  const { data, error } = await service
    .from('shipment_tasks')
    .update(update)
    .eq('task_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
