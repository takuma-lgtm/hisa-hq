import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'

export default async function RecurringPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Recurring customers: status = 'recurring_customer'
  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .eq('status', 'recurring_customer')
    .order('cafe_name')

  // Fetch all recurring orders for these customers
  const customerIds = (customers ?? []).map((c) => c.customer_id)
  const { data: allOrders } = customerIds.length
    ? await supabase
        .from('recurring_orders')
        .select('order_id, customer_id, total_amount, created_at, status')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Recurring Customers</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {customers?.length ?? 0} active matcha accounts
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-6">
        {!customers?.length ? (
          <div className="text-center py-20 text-slate-400 text-sm">
            No recurring customers yet. Mark an opportunity as Won to add one.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {customers.map((c) => {
              const orders = (allOrders ?? []).filter((o) => o.customer_id === c.customer_id)
              const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount ?? 0), 0)
              const latestOrder = orders[0]

              return (
                <Link
                  key={c.customer_id}
                  href={`/recurring/${c.customer_id}`}
                  className="bg-white border border-slate-200 rounded-xl p-5 hover:border-green-300 hover:shadow-sm transition-all block"
                >
                  {/* Avatar + name */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <span className="text-green-800 text-sm font-semibold">
                        {c.cafe_name.charAt(0)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{c.cafe_name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {[c.city, c.country].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-slate-400 mb-0.5">Monthly usage</p>
                      <p className="font-medium text-slate-800">
                        {c.monthly_matcha_usage_kg != null ? `${c.monthly_matcha_usage_kg} kg` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-0.5">Total revenue</p>
                      <p className="font-medium text-slate-800">
                        {totalRevenue > 0 ? formatCurrency(totalRevenue) : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-0.5">Orders</p>
                      <p className="font-medium text-slate-800">{orders.length}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-0.5">Last order</p>
                      <p className="font-medium text-slate-800">
                        {latestOrder ? formatDate(latestOrder.created_at) : '—'}
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
