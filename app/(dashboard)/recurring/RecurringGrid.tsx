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
  const now = Date.now()
  const twentyFiveDays = 25 * 24 * 60 * 60 * 1000

  const customersWithOrders = customers.map((c) => {
    const orders = allOrders.filter((o) => o.customer_id === c.customer_id)
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount ?? 0), 0)
    const latestOrder = orders[0]
    const lastOrderDate = latestOrder ? new Date(latestOrder.created_at) : null
    const nextExpected = lastOrderDate ? new Date(lastOrderDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null
    const isOverdue = nextExpected ? nextExpected.getTime() < now : false
    const needsReorder = lastOrderDate ? (now - lastOrderDate.getTime()) > twentyFiveDays : false

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
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          {/* Sticky header */}
          <div className="flex items-center px-6 py-2 border-b border-slate-200 bg-white sticky top-0 z-10 text-xs text-slate-400 font-medium min-w-[860px]">
            <div className="flex-1 min-w-0">Customer</div>
            <div className="w-40 shrink-0">Products</div>
            <div className="w-24 shrink-0">Volume</div>
            <div className="w-28 shrink-0">Revenue</div>
            <div className="w-28 shrink-0">Last Order</div>
            <div className="w-32 shrink-0">Next Expected</div>
          </div>

          {/* Rows */}
          <div className="min-w-[860px]">
            {filtered.map((c) => {
              const visibleProducts = c.products.slice(0, 2)
              const overflowProducts = c.products.slice(2)

              return (
                <Link
                  key={c.customer_id}
                  href={`/recurring/${c.customer_id}`}
                  className="flex items-center px-6 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors duration-150 cursor-pointer last:border-b-0"
                >
                  {/* Avatar + name */}
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <span className="text-green-700 text-sm font-semibold">{c.cafe_name.charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{c.cafe_name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {[c.city, c.country].filter(Boolean).join(', ') || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Products */}
                  <div className="w-40 shrink-0 flex items-center gap-1 flex-wrap">
                    {visibleProducts.length > 0 ? (
                      <>
                        {visibleProducts.map((p, i) => (
                          <span key={i} className="text-[11px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded truncate max-w-[72px]">
                            {p}
                          </span>
                        ))}
                        {overflowProducts.length > 0 && (
                          <span
                            className="text-[11px] text-slate-400 cursor-default"
                            title={overflowProducts.join(', ')}
                          >
                            +{overflowProducts.length}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </div>

                  {/* Volume */}
                  <div className="w-24 shrink-0 text-sm text-slate-600">
                    {c.monthly_matcha_usage_kg != null
                      ? `${c.monthly_matcha_usage_kg} kg`
                      : <span className="text-slate-300">—</span>}
                  </div>

                  {/* Revenue */}
                  <div className="w-28 shrink-0 text-sm text-slate-600">
                    {c.totalRevenue > 0 ? formatCurrency(c.totalRevenue) : <span className="text-slate-300">—</span>}
                  </div>

                  {/* Last order */}
                  <div className="w-28 shrink-0 text-xs text-slate-500">
                    {c.lastOrderDate ? formatDate(c.lastOrderDate.toISOString()) : <span className="text-slate-300">—</span>}
                  </div>

                  {/* Next expected */}
                  <div className={`w-32 shrink-0 text-xs ${c.isOverdue ? 'text-red-500 font-medium' : 'text-slate-500'}`}>
                    {c.nextExpected ? (
                      <>
                        {formatDate(c.nextExpected.toISOString())}
                        {c.isOverdue && <span className="ml-1 text-red-400">(overdue)</span>}
                      </>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
