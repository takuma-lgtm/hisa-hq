import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'

async function getStats(role: UserRole) {
  const supabase = await createClient()

  if (role === 'lead_gen') {
    const [{ count: totalLeads }, { count: replied }, { count: qualified }] = await Promise.all([
      supabase.from('customers').select('*', { count: 'exact', head: true }),
      supabase
        .from('instagram_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'replied'),
      supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('stage', 'sample_approved'),
    ])
    return { totalLeads, replied, qualified }
  }

  if (role === 'closer') {
    const [{ count: inTransit }, { count: delivered }, { count: quotesPending }, { count: paymentsPending }] =
      await Promise.all([
        supabase.from('sample_batches').select('*', { count: 'exact', head: true }).neq('delivery_status', 'Delivered').not('tracking_number', 'is', null),
        supabase.from('sample_batches').select('*', { count: 'exact', head: true }).eq('delivery_status', 'Delivered'),
        supabase.from('quotations').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
        supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('payment_status', 'pending'),
      ])
    return { inTransit, delivered, quotesPending, paymentsPending }
  }

  // admin
  const [{ count: totalLeads }, { count: activeCustomers }, { count: pendingPayments }] =
    await Promise.all([
      supabase.from('customers').select('*', { count: 'exact', head: true }),
      supabase.from('customers').select('*', { count: 'exact', head: true }).eq('status', 'recurring_customer'),
      supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('payment_status', 'pending'),
    ])
  return { totalLeads, activeCustomers, pendingPayments }
}

function StatCard({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-sm text-slate-500 mb-1">{label}</p>
      <p className="text-3xl font-semibold text-slate-900">{value ?? 0}</p>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user!.id)
    .single()

  const role = (profile?.role ?? 'lead_gen') as UserRole
  const stats = await getStats(role)

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">
          Good morning, {profile?.name} 👋
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Here&apos;s what&apos;s happening today.</p>
      </div>

      {role === 'lead_gen' && 'totalLeads' in stats && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Leads" value={stats.totalLeads} />
          <StatCard label="Replied on Instagram" value={stats.replied} />
          <StatCard label="Qualified Leads" value={stats.qualified} />
        </div>
      )}

      {role === 'closer' && 'inTransit' in stats && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Samples In Transit" value={stats.inTransit} />
          <StatCard label="Samples Delivered" value={stats.delivered} />
          <StatCard label="Quotes Pending" value={stats.quotesPending} />
          <StatCard label="Payments Pending" value={stats.paymentsPending} />
        </div>
      )}

      {role === 'admin' && 'activeCustomers' in stats && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Leads" value={stats.totalLeads} />
          <StatCard label="Recurring Customers" value={stats.activeCustomers} />
          <StatCard label="Payments Pending" value={stats.pendingPayments} />
        </div>
      )}
    </div>
  )
}
