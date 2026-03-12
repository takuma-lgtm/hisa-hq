import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'
import LeadsTable from './LeadsTable'
import LeadImportButton from './LeadImportButton'

export default async function LeadsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: leads }, { data: profiles }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase
      .from('customers')
      .select('*')
      .eq('status', 'lead')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, name').order('name'),
  ])

  const role = (profile?.role ?? 'lead_gen') as UserRole
  const canImport = role === 'admin' || role === 'lead_gen'

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Leads</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {leads?.length ?? 0} leads in CRM
          </p>
        </div>
        {canImport && <LeadImportButton />}
      </div>

      {leads?.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          No leads yet.{' '}
          {canImport
            ? 'Click "Import from Sheets" to pull in your lead list.'
            : 'Ask Takuma or Nina to import the lead list.'}
        </div>
      ) : (
        <LeadsTable leads={leads ?? []} profiles={profiles ?? []} />
      )}
    </div>
  )
}
