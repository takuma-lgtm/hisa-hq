'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'

interface RecurringOrderData {
  order_id: string
  customer_id: string
  total_amount: number | null
  created_at: string
  status: string
  line_items: unknown
  monthly_volume: number | null
}

interface CustomerData {
  customer_id: string
  cafe_name: string
  city: string | null
  country: string | null
  monthly_matcha_usage_kg: number | null
}

interface Props {
  customers: CustomerData[]
  allOrders: RecurringOrderData[]
}

export default function RecurringGrid({ customers, allOrders }: Props) {
  const [filter, setFilter] = useState<'all' | 'reorder'>('all')
  // eslint-disable-next-line react-hooks/purity -- stable within a single render
  const now = Date.now()
  const twentyFiveDays = 25 * 24 * 60 * 60 * 1000

  const customersWithOrders = customers.map((c) => {
    const orders = allOrders.filter((o) => o.customer_id === c.customer_id)
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount ?? 0), 0)
    const latestOrder = orders[0] // already sorted DESC
    const lastOrderDate = latestOrder ? new Date(latestOrder.created_at) : null
    const nextExpected = lastOrderDate ? new Date(lastOrderDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null
    const isOverdue = nextExpected ? nextExpected.getTime() < now : false
    const needsReorder = lastOrderDate ? (now - lastOrderDate.getTime()) > twentyFiveDays : false

    // Parse line items from latest order
    let products: string[] = []
    if (latestOrder?.line_items && Array.isArray(latestOrder.line_items)) {
      products = (latestOrder.line_items as Array<{ product_name?: string }>)
        .map((item) => item.product_name ?? '')
        .filter(Boolean)
    }

    return { ...c, orders, totalRevenue, latestOrder, lastOrderDate, nextExpected, isOverdue, needsReorder, products }
  })

  const filtered = filter === 'reorder'
    ? customersWithOrders.filter((c) => c.needsReorder)
    : customersWithOrders

  return (
    <>
      {/* Filter toggle */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          All Customers
        </button>
        <button
          onClick={() => setFilter('reorder')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            filter === 'reorder' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Needs Reorder
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400 text-sm">
          {filter === 'reorder'
            ? 'All customers are up to date with their orders.'
            : 'No recurring customers yet. Mark an opportunity as Won to add one.'}
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {filtered.map((c) => (
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

              {/* Products */}
              {c.products.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-slate-400 mb-1">Products</p>
                  <div className="flex flex-wrap gap-1">
                    {c.products.map((p, i) => (
                      <span key={i} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-slate-400 mb-0.5">Monthly volume</p>
                  <p className="font-medium text-slate-800">
                    {c.monthly_matcha_usage_kg != null ? `${c.monthly_matcha_usage_kg} kg` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 mb-0.5">Lifetime revenue</p>
                  <p className="font-medium text-slate-800">
                    {c.totalRevenue > 0 ? formatCurrency(c.totalRevenue) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 mb-0.5">Last order</p>
                  <p className="font-medium text-slate-800">
                    {c.lastOrderDate ? formatDate(c.lastOrderDate.toISOString()) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 mb-0.5">Next expected</p>
                  <p className={`font-medium ${c.isOverdue ? 'text-red-600' : 'text-slate-800'}`}>
                    {c.nextExpected
                      ? formatDate(c.nextExpected.toISOString())
                      : '—'}
                    {c.isOverdue && ' (overdue)'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 mb-0.5">Orders</p>
                  <p className="font-medium text-slate-800">{c.orders.length}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
        {filtered.length > 0 && filtered.length < 3 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-slate-400">
              {filtered.length} recurring {filtered.length === 1 ? 'customer' : 'customers'} so far.
            </p>
            <p className="text-xs text-slate-300 mt-1">
              Win more deals to grow your recurring customer base.
            </p>
          </div>
        )}
        </>
      )}
    </>
  )
}
