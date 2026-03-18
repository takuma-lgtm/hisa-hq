import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { UserRole, CrmSetting } from '@/types/database'
import { isAdmin, isOwner } from '@/lib/auth'
import SettingsForm from './SettingsForm'
import TeamManagement from './TeamManagement'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = (profile?.role ?? 'member') as UserRole
  if (!isAdmin(role)) redirect('/')

  const service = createServiceClient()
  const { data: settings } = await service
    .from('crm_settings')
    .select('*')
    .order('category')
    .order('key')

  // Group by category
  const grouped: Record<string, CrmSetting[]> = {}
  for (const s of settings ?? []) {
    const cat = s.category || 'general'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(s)
  }

  // Team data (owner only)
  let teamMembers: { id: string; name: string; email: string; role: string; created_at: string }[] = []
  if (isOwner(role)) {
    const { data: profiles } = await service.from('profiles').select('id, name, role, created_at').order('created_at')
    const { data: { users } } = await service.auth.admin.listUsers()
    const emailMap: Record<string, string> = {}
    for (const u of users ?? []) {
      emailMap[u.id] = u.email ?? ''
    }
    teamMembers = (profiles ?? []).map((p) => ({
      ...p,
      email: emailMap[p.id] ?? '',
    })).sort((a, b) => {
      if (a.role === 'owner') return -1
      if (b.role === 'owner') return 1
      return 0
    })
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 shrink-0">
        <h1 className="text-2xl font-serif text-slate-900">Settings</h1>
        <p className="text-xs text-slate-500 mt-0.5">Manage exchange rates, shipping costs, and company info</p>
      </div>
      <div className="flex-1 overflow-auto p-6 bg-slate-50/50 space-y-6">
        {isOwner(role) && (
          <TeamManagement initialTeam={teamMembers} currentUserId={user.id} />
        )}
        <SettingsForm grouped={grouped} stripeConfigured={!!process.env.STRIPE_SECRET_KEY} />
      </div>
    </div>
  )
}
