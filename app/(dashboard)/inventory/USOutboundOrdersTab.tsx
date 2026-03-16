'use client'

import { useState, useEffect, useCallback } from 'react'
import { Package, Truck, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import type { USOutboundOrder, USOutboundOrderItem } from '@/types/database'
import USOrderDetailPanel from './USOrderDetailPanel'

type OrderWithItems = USOutboundOrder & { items: USOutboundOrderItem[] }

const STATUS_OPTIONS = ['', 'pending', 'packed', 'shipped', 'delivered'] as const

export default function USOutboundOrdersTab() {
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    const res = await fetch(`/api/orders/us?${params}`)
    if (res.ok) {
      const data = await res.json()
      setOrders(data)
    }
    setLoading(false)
  }, [statusFilter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data fetch pattern
    fetchOrders()
  }, [fetchOrders])

  function statusBadge(status: string) {
    const config: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
      pending: { icon: <Clock className="w-3 h-3" />, cls: 'bg-slate-100 text-slate-600', label: 'Pending' },
      packed: { icon: <Package className="w-3 h-3" />, cls: 'bg-amber-50 text-amber-700', label: 'Packed' },
      shipped: { icon: <Truck className="w-3 h-3" />, cls: 'bg-blue-50 text-blue-700', label: 'Shipped' },
      delivered: { icon: <CheckCircle className="w-3 h-3" />, cls: 'bg-green-50 text-green-700', label: 'Delivered' },
    }
    const c = config[status] ?? config.pending
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded ${c.cls}`}>
        {c.icon}
        {c.label}
      </span>
    )
  }

  function itemsSummary(items: USOutboundOrderItem[]) {
    return items.map(i => `${i.quantity}x ${i.sku_name}`).join(', ')
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-200 shrink-0">
        {STATUS_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
              statusFilter === s
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">{orders.length} orders</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 w-8" />
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Order #</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Customer</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Status</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Items</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Shipped</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Carrier</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Tracking #</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Value</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-slate-400 text-sm">Loading...</td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-slate-400 text-sm">
                  No US orders found.
                </td>
              </tr>
            ) : (
              orders.map(order => (
                <OrderRow
                  key={order.order_id}
                  order={order}
                  expanded={expandedId === order.order_id}
                  onToggle={() => setExpandedId(expandedId === order.order_id ? null : order.order_id)}
                  statusBadge={statusBadge}
                  itemsSummary={itemsSummary}
                  onUpdated={fetchOrders}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function OrderRow({
  order,
  expanded,
  onToggle,
  statusBadge,
  itemsSummary,
  onUpdated,
}: {
  order: OrderWithItems
  expanded: boolean
  onToggle: () => void
  statusBadge: (s: string) => React.ReactNode
  itemsSummary: (items: USOutboundOrderItem[]) => string
  onUpdated: () => void
}) {
  return (
    <>
      <tr
        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-2.5 text-slate-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </td>
        <td className="px-4 py-2.5 font-medium text-slate-900">{order.order_number}</td>
        <td className="px-4 py-2.5 text-slate-700">{order.customer_name}</td>
        <td className="px-4 py-2.5">{statusBadge(order.status)}</td>
        <td className="px-4 py-2.5 text-slate-600 text-xs max-w-[200px] truncate">
          {itemsSummary(order.items)}
        </td>
        <td className="px-4 py-2.5 text-slate-600">{order.date_shipped || '—'}</td>
        <td className="px-4 py-2.5 text-slate-600">{order.carrier || '—'}</td>
        <td className="px-4 py-2.5 text-slate-600 font-mono text-xs">{order.tracking_number || '—'}</td>
        <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
          {order.total_item_value_usd != null ? `$${Number(order.total_item_value_usd).toFixed(2)}` : '—'}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} className="p-0">
            <USOrderDetailPanel order={order} onUpdated={onUpdated} />
          </td>
        </tr>
      )}
    </>
  )
}
