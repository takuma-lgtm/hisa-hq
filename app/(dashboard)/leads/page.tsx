import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'
import LeadsTable from './LeadsTable'
import AddLeadsButton from './AddLeadsButton'

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
  const canEdit = role === 'admin' || role === 'lead_gen'

  // Fetch outreach stats from instagram_logs
  const customerIds = (leads ?? []).map((l) => l.customer_id)
  const outreachStats: Record<string, { lastOutreachDate: string | null; outreachCount: number; daysSinceContact: number | null; latestStatus: string | null }> = {}

  if (customerIds.length > 0) {
    const { data: logs } = await supabase
      .from('instagram_logs')
      .select('customer_id, created_at, status')
      .in('customer_id', customerIds)
      .order('created_at', { ascending: false })

    const now = Date.now()
    const byCustomer = new Map<string, { dates: string[]; latestStatus: string | null }>()
    for (const log of logs ?? []) {
      const entry = byCustomer.get(log.customer_id) ?? { dates: [], latestStatus: null }
      entry.dates.push(log.created_at)
      // First log per customer (ordered DESC) is the latest
      if (entry.latestStatus === null) entry.latestStatus = log.status
      byCustomer.set(log.customer_id, entry)
    }

    for (const cid of customerIds) {
      const entry = byCustomer.get(cid)
      if (!entry || entry.dates.length === 0) {
        outreachStats[cid] = { lastOutreachDate: null, outreachCount: 0, daysSinceContact: null, latestStatus: null }
      } else {
        const lastDate = entry.dates[0]
        const daysSince = Math.floor((now - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
        outreachStats[cid] = { lastOutreachDate: lastDate, outreachCount: entry.dates.length, daysSinceContact: daysSince, latestStatus: entry.latestStatus }
      }
    }
  }

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
        {canImport && <AddLeadsButton />}
      </div>

      {leads?.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          No leads yet.{' '}
          {canImport
            ? 'Click "Add Leads" to import your lead list.'
            : 'Ask Takuma or Nina to import the lead list.'}
        </div>
      ) : (
        <LeadsTable leads={leads ?? []} profiles={profiles ?? []} outreachStats={outreachStats} canEdit={canEdit} />
      )}
    </div>
  )
}
