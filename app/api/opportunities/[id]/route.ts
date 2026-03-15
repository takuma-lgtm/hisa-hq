import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: opportunityId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['closer', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const allowedFields: Record<string, unknown> = {}

  if (body.stage !== undefined) allowedFields.stage = body.stage
  if (body.notes !== undefined) allowedFields.notes = body.notes
  if (body.disqualified_reason !== undefined) allowedFields.disqualified_reason = body.disqualified_reason

  if (body.stage === 'disqualified') {
    allowedFields.disqualified_at = new Date().toISOString()
  }

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  allowedFields.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('opportunities')
    .update(allowedFields)
    .eq('opportunity_id', opportunityId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
