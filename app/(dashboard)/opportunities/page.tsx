import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole, OpportunityStage } from '@/types/database'
import { OPPORTUNITY_TABLE_STAGES } from '@/lib/constants'
import OpportunitiesTable from './OpportunitiesTable'

export default async function OpportunitiesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const visibleStages: OpportunityStage[] = [...OPPORTUNITY_TABLE_STAGES, 'disqualified', 'lost']

  const [{ data: profile }, { data: opportunities }, { data: profiles }, { data: products }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase
      .from('opportunities')
      .select(`
        *,
        customer:customers (
          customer_id,
          cafe_name,
          city,
          country,
          state,
          contact_person,
          phone,
          email,
          instagram_url,
          instagram_handle,
          address,
          zip_code,
          qualified_products,
          qualified_volume_kg,
          qualified_budget
        ),
        assigned_profile:profiles!opportunities_assigned_to_fkey(id, name, role)
      `)
      .in('stage', visibleStages)
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, name').order('name'),
    supabase
      .from('products')
      .select('product_id, customer_facing_product_name, supplier_product_name, selling_price_usd, selling_price_gbp, selling_price_eur, min_price_usd, min_price_gbp, min_price_eur, us_landing_cost_per_kg_usd, uk_landing_cost_per_kg_gbp, eu_landing_cost_per_kg_eur, active')
      .eq('active', true)
      .order('customer_facing_product_name'),
  ])

  const role = (profile?.role ?? 'lead_gen') as UserRole
  const activeCount = (opportunities ?? []).filter(
    (o) => o.stage !== 'disqualified' && o.stage !== 'lost',
  ).length

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Opportunities</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeCount} active deal{activeCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {(opportunities ?? []).length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          No opportunities yet. Convert qualified leads from the Leads page.
        </div>
      ) : (
        <Suspense>
          <OpportunitiesTable
            opportunities={(opportunities ?? []) as never}
            profiles={profiles ?? []}
            products={(products ?? []) as never}
            userRole={role}
          />
        </Suspense>
      )}
    </div>
  )
}
