import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CAFE_TYPE_LABELS, CUSTOMER_STATUS_LABELS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { Customer } from '@/types/database'

const STATUS_COLORS: Record<Customer['status'], string> = {
  lead: 'bg-slate-100 text-slate-700',
  qualified_opportunity: 'bg-violet-50 text-violet-700',
  recurring_customer: 'bg-green-50 text-green-700',
  lost: 'bg-red-50 text-red-700',
}

export default async function CustomersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Customers</h1>
          <p className="text-xs text-slate-500 mt-0.5">{customers?.length ?? 0} total cafes</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/customers/import"
            className="inline-flex items-center gap-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            Import CSV
          </a>
          <a
            href="/customers/new"
            className="inline-flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            + Add Customer
          </a>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Cafe</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Location</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Monthly kg</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(customers ?? []).map((c) => (
                <tr key={c.customer_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/customers/${c.customer_id}`} className="hover:text-green-700 transition-colors">
                      <p className="font-medium text-slate-900">{c.cafe_name}</p>
                      {c.contact_person && (
                        <p className="text-xs text-slate-400 mt-0.5">{c.contact_person}</p>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.cafe_type ? CAFE_TYPE_LABELS[c.cafe_type] : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {[c.city, c.country].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.monthly_matcha_usage_kg != null ? `${c.monthly_matcha_usage_kg} kg` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>
                      {CUSTOMER_STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {formatDate(c.created_at)}
                  </td>
                </tr>
              ))}
              {!customers?.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">
                    No customers yet. Import a CSV or add one manually.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
