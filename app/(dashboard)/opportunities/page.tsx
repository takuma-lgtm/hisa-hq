import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import KanbanBoard from '@/components/kanban/KanbanBoard'
import type { UserRole } from '@/types/database'

export default async function OpportunitiesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: opportunities }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase
      .from('opportunities')
      .select(`
        *,
        customer:customers (
          customer_id,
          cafe_name,
          city,
          state,
          country,
          address,
          zip_code,
          instagram_handle,
          contact_person,
          phone,
          monthly_matcha_usage_kg,
          budget_delivered_price_per_kg,
          budget_currency,
          current_supplier,
          current_supplier_unknown,
          cafe_segment,
          matcha_experience
        )
      `)
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Opportunities</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {opportunities?.length ?? 0} active deals across 14 stages
          </p>
        </div>
        <a
          href="/customers?new=1"
          className="inline-flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          + New Lead
        </a>
      </div>

      <KanbanBoard
        initialOpportunities={opportunities ?? []}
        userRole={(profile?.role ?? 'lead_gen') as UserRole}
      />
    </div>
  )
}
