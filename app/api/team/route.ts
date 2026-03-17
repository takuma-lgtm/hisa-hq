import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canManageTeam } from '@/lib/auth'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (!canManageTeam(profile?.role)) {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }

  // Get all profiles
  const { data: profiles } = await service.from('profiles').select('id, name, role, created_at').order('created_at')

  // Get emails from auth.users via admin API
  const { data: { users } } = await service.auth.admin.listUsers()
  const emailMap: Record<string, string> = {}
  for (const u of users ?? []) {
    emailMap[u.id] = u.email ?? ''
  }

  const team = (profiles ?? []).map((p) => ({
    ...p,
    email: emailMap[p.id] ?? '',
  }))

  return NextResponse.json({ team })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (!canManageTeam(profile?.role)) {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }

  const { email, name, role } = await req.json()
  if (!email || !name || !role) {
    return NextResponse.json({ error: 'email, name, and role are required' }, { status: 400 })
  }

  if (!['admin', 'member'].includes(role)) {
    return NextResponse.json({ error: 'Role must be admin or member' }, { status: 400 })
  }

  // Generate a temp password
  const tempPassword = `Hisa${Math.random().toString(36).slice(2, 8)}!`

  const { data: newUser, error } = await service.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name, role },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    user: { id: newUser.user.id, email, name, role },
    tempPassword,
  })
}
