'use client'

import { useState, useEffect, useCallback } from 'react'
import { Package, Truck, CheckCircle, Clock, ChevronDown, ChevronUp, ShoppingCart, Printer } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import type { USOutboundOrder, USOutboundOrderItem } from '@/types/database'
import USOrderDetailPanel from './USOrderDetailPanel'

type OrderWithItems = USOutboundOrder & { items: USOutboundOrderItem[] }

const STATUS_OPTIONS = ['', 'pending', 'packed', 'shipped', 'delivered'] as const

interface Props {
  open: boolean
  onClose: () => void
  onNewOrder: () => void
  canWrite: boolean
}

export default function USOrdersDrawer({ open, onClose, onNewOrder, canWrite }: Props) {
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
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
    if (open) fetchOrders()
  }, [open, fetchOrders])

  function statusBadge(status: string) {
    const config: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
      pending: { icon: <Clock className="w-3 h-3" />, cls: 'bg-slate-100 text-slate-600', label: 'Pending' },
      packed: { icon: <Package className="w-3 h-3" />, cls: 'bg-amber-50 text-amber-700', label: 'Packed' },
      shipped: { icon: <Truck className="w-3 h-3" />, cls: 'bg-blue-50 text-blue-700', label: 'Shipped' },
      delivered: { icon: <CheckCircle className="w-3 h-3" />, cls: 'bg-green-50 text-green-700', label: 'Delivered' },
    }
    const c = config[status] ?? config.pending
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${c.cls}`}>
        {c.icon}
        {c.label}
      </span>
    )
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-[700px] sm:max-w-[700px] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center justify-between pr-8">
            <div>
              <SheetTitle>US Live Orders</SheetTitle>
              <SheetDescription>{orders.length} orders</SheetDescription>
            </div>
            {canWrite && (
              <button
                onClick={onNewOrder}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                New US Order
              </button>
            )}
          </div>
        </SheetHeader>

        {/* Status filter pills */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-200 shrink-0">
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
        </div>

        {/* Orders list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center text-sm text-slate-400 py-12">Loading...</p>
          ) : orders.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-12">No US orders found.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {orders.map(order => (
                <div key={order.order_id}>
                  <button
                    className="w-full text-left px-6 py-3 hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedId(expandedId === order.order_id ? null : order.order_id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-sm text-slate-900">{order.order_number}</span>
                        {statusBadge(order.status)}
                      </div>
                      <div className="flex items-center gap-3">
                        {order.total_item_value_usd != null && (
                          <span className="text-xs tabular-nums text-slate-600">
                            ${Number(order.total_item_value_usd).toFixed(2)}
                          </span>
                        )}
                        {expandedId === order.order_id
                          ? <ChevronUp className="w-4 h-4 text-slate-400" />
                          : <ChevronDown className="w-4 h-4 text-slate-400" />
                        }
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-slate-600">{order.customer_name}</span>
                      <span className="text-xs text-slate-400">
                        {order.items?.map(i => `${i.quantity}x ${i.sku_name}`).join(', ')}
                      </span>
                    </div>
                    {order.date_shipped && (
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                        <span>{order.carrier}</span>
                        <span>Shipped {order.date_shipped}</span>
                        {order.tracking_number && (
                          <span className="font-mono">{order.tracking_number}</span>
                        )}
                      </div>
                    )}
                    {order.order_id && (
                      <a
                        href={`/inventory/packing-slip/${order.order_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1.5 text-xs text-green-600 hover:text-green-700"
                        onClick={e => e.stopPropagation()}
                      >
                        <Printer className="w-3 h-3" />
                        Packing Slip
                      </a>
                    )}
                  </button>
                  {expandedId === order.order_id && (
                    <div className="border-t border-slate-100">
                      <USOrderDetailPanel order={order} onUpdated={fetchOrders} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
