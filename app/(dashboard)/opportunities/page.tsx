import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { UserRole, OpportunityStage, PaymentStatus } from '@/types/database'
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
      .select('product_id, customer_facing_product_name, supplier_product_name, selling_price_usd, selling_price_gbp, selling_price_eur, min_price_usd, min_price_gbp, min_price_eur, us_landing_cost_per_kg_usd, uk_landing_cost_per_kg_gbp, eu_landing_cost_per_kg_eur, active, tasting_headline')
      .eq('active', true)
      .eq('is_competitor', false)
      .order('customer_facing_product_name'),
  ])

  const role = (profile?.role ?? 'member') as UserRole

  // Fetch latest invoice payment status per opportunity
  const service = createServiceClient()
  const { data: invoiceRows } = await service
    .from('invoices')
    .select('opportunity_id, payment_status')
    .order('created_at', { ascending: false })
  const invoiceStatusMap: Record<string, PaymentStatus> = {}
  for (const row of invoiceRows ?? []) {
    if (row.opportunity_id && !invoiceStatusMap[row.opportunity_id]) {
      invoiceStatusMap[row.opportunity_id] = row.payment_status
    }
  }

  const activeCount = (opportunities ?? []).filter(
    (o) => o.stage !== 'disqualified' && o.stage !== 'lost',
  ).length

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
        <div>
          <h1 className="text-2xl font-serif text-slate-900">Opportunities</h1>
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
            invoiceStatuses={invoiceStatusMap}
          />
        </Suspense>
      )}
    </div>
  )
}
