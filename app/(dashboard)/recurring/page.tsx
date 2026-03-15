import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RecurringGrid from './RecurringGrid'

export default async function RecurringPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: customers } = await supabase
    .from('customers')
    .select('customer_id, cafe_name, city, country, monthly_matcha_usage_kg')
    .eq('status', 'recurring_customer')
    .order('cafe_name')

  const customerIds = (customers ?? []).map((c) => c.customer_id)
  const { data: allOrders } = customerIds.length
    ? await supabase
        .from('recurring_orders')
        .select('order_id, customer_id, total_amount, created_at, status, line_items, monthly_volume')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Recurring Customers</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {customers?.length ?? 0} active matcha accounts
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <RecurringGrid
          customers={(customers ?? []) as { customer_id: string; cafe_name: string; city: string | null; country: string | null; monthly_matcha_usage_kg: number | null }[]}
          allOrders={(allOrders ?? []) as { order_id: string; customer_id: string; total_amount: number | null; created_at: string; status: string; line_items: unknown; monthly_volume: number | null }[]}
        />
      </div>
    </div>
  )
}
