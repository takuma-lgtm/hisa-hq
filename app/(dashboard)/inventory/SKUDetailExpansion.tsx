'use client'

import { useState, useEffect } from 'react'
import { Printer } from 'lucide-react'

interface Transaction {
  transaction_id: string
  transaction_ref: string | null
  date_received: string | null
  date_shipped: string | null
  movement_type: string
  from_location: string | null
  to_destination: string | null
  qty_change: number
  carrier: string | null
  delivery_status: string | null
  created_at: string
}

interface USOrder {
  order_id: string
  order_number: string
  customer_name: string
  status: string
  date_shipped: string | null
  carrier: string | null
  tracking_number: string | null
  items: { sku_id: string; sku_name: string; quantity: number }[]
}

const MOVEMENT_LABELS: Record<string, { label: string; color: string }> = {
  inbound_supplier_jp: { label: 'Inbound', color: 'bg-green-50 text-green-700' },
  transfer_jp_us_out: { label: 'Transfer → US', color: 'bg-blue-50 text-blue-700' },
  transfer_jp_us_in: { label: 'Received US', color: 'bg-blue-50 text-blue-700' },
  direct_jp_us_customer: { label: 'Direct → US', color: 'bg-orange-50 text-orange-700' },
  direct_jp_intl_customer: { label: 'Direct → Intl', color: 'bg-orange-50 text-orange-700' },
  us_local_customer: { label: 'US → Customer', color: 'bg-purple-50 text-purple-700' },
  personal_use: { label: 'Personal', color: 'bg-slate-100 text-slate-600' },
  adjustment: { label: 'Adjustment', color: 'bg-red-50 text-red-600' },
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  packed: 'bg-amber-50 text-amber-700',
  shipped: 'bg-blue-50 text-blue-700',
  delivered: 'bg-green-50 text-green-700',
}

interface Props {
  skuId: string
  skuName: string
}

export default function SKUDetailExpansion({ skuId, skuName }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [totalTxns, setTotalTxns] = useState(0)
  const [orders, setOrders] = useState<USOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      setLoading(true)
      const [txnRes, ordersRes] = await Promise.all([
        fetch(`/api/inventory/transactions?sku_id=${skuId}&limit=10`),
        fetch('/api/orders/us'),
      ])

      if (cancelled) return

      if (txnRes.ok) {
        const txnData = await txnRes.json()
        setTransactions(txnData.data ?? [])
        setTotalTxns(txnData.total ?? 0)
      }

      if (ordersRes.ok) {
        const allOrders: USOrder[] = await ordersRes.json()
        const related = allOrders.filter(o =>
          o.items?.some(i => i.sku_id === skuId),
        )
        setOrders(related)
      } else {
        console.error('Failed to fetch US orders:', ordersRes.status)
      }

      setLoading(false)
    }

    fetchData()
    return () => { cancelled = true }
  }, [skuId])

  if (loading) {
    return (
      <div className="bg-slate-50 border-t border-slate-200 px-8 py-6 text-center text-sm text-slate-400">
        Loading {skuName} details...
      </div>
    )
  }

  return (
    <div className="bg-slate-50 border-t border-slate-200 px-8 py-4">
      <div className="grid grid-cols-3 gap-6">
        {/* Recent Transactions — takes 2 cols */}
        <div className="col-span-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Recent Transactions
            {totalTxns > 10 && <span className="font-normal text-slate-400 ml-1">({totalTxns} total)</span>}
          </h4>
          {transactions.length === 0 ? (
            <p className="text-xs text-slate-400">No transactions recorded.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-200">
                  <th className="text-left pb-1.5 pr-3">Date</th>
                  <th className="text-left pb-1.5 pr-3">Ref</th>
                  <th className="text-left pb-1.5 pr-3">Movement</th>
                  <th className="text-left pb-1.5 pr-3">From / To</th>
                  <th className="text-right pb-1.5 pr-3">Qty</th>
                  <th className="text-left pb-1.5 pr-3">Carrier</th>
                  <th className="text-left pb-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(txn => {
                  const date = txn.date_shipped || txn.date_received || txn.created_at?.split('T')[0]
                  const movement = MOVEMENT_LABELS[txn.movement_type]
                  const isPositive = txn.qty_change > 0
                  return (
                    <tr key={txn.transaction_id} className="border-b border-slate-100">
                      <td className="py-1.5 pr-3 text-slate-600">{date}</td>
                      <td className="py-1.5 pr-3 font-medium text-slate-700">{txn.transaction_ref || '—'}</td>
                      <td className="py-1.5 pr-3">
                        <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${movement?.color || 'bg-slate-50 text-slate-600'}`}>
                          {movement?.label || txn.movement_type}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 text-slate-500 truncate max-w-[140px]">
                        {txn.from_location} → {txn.to_destination}
                      </td>
                      <td className={`py-1.5 pr-3 text-right tabular-nums font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}{txn.qty_change}
                      </td>
                      <td className="py-1.5 pr-3 text-slate-500">{txn.carrier || '—'}</td>
                      <td className="py-1.5 text-slate-500">{txn.delivery_status || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Related US Orders — takes 1 col */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            US Orders
          </h4>
          {orders.length === 0 ? (
            <p className="text-xs text-slate-400">No US orders for this SKU.</p>
          ) : (
            <div className="space-y-2">
              {orders.map(order => {
                const item = order.items.find(i => i.sku_id === skuId)
                return (
                  <div key={order.order_id} className="bg-white border border-slate-200 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-900">{order.order_number}</span>
                      <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[order.status] || STATUS_COLORS.pending}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{order.customer_name}</p>
                    <div className="flex items-center justify-between mt-1 text-xs text-slate-400">
                      <span>{item ? `${item.quantity}x ${item.sku_name}` : ''}</span>
                      <span>{order.date_shipped || '—'}</span>
                    </div>
                    <a
                      href={`/inventory/packing-slip/${order.order_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 mt-1.5 text-xs text-green-600 hover:text-green-700"
                    >
                      <Printer className="w-3 h-3" />
                      Packing Slip
                    </a>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
