import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canManageTeam } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (!canManageTeam(profile?.role)) {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }

  // Can't change own role away from owner
  if (id === user.id) {
    return NextResponse.json({ error: 'Cannot modify owner role' }, { status: 400 })
  }

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if (body.role && ['admin', 'member'].includes(body.role)) updates.role = body.role
  if (body.name) updates.name = body.name

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await service.from('profiles').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ profile: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (!canManageTeam(profile?.role)) {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }

  if (id === user.id) {
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
  }

  const { error } = await service.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
