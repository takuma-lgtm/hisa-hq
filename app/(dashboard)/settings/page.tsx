import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { UserRole, CrmSetting } from '@/types/database'
import SettingsForm from './SettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = (profile?.role ?? 'lead_gen') as UserRole
  if (role !== 'admin') redirect('/')

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

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 shrink-0">
        <h1 className="text-2xl font-serif text-slate-900">Settings</h1>
        <p className="text-xs text-slate-500 mt-0.5">Manage exchange rates, shipping costs, and company info</p>
      </div>
      <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
        <SettingsForm grouped={grouped} stripeConfigured={!!process.env.STRIPE_SECRET_KEY} />
      </div>
    </div>
  )
}
