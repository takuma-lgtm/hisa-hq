'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Printer } from 'lucide-react'
import type { USOutboundOrder, USOutboundOrderItem } from '@/types/database'

type OrderWithItems = USOutboundOrder & { items: USOutboundOrderItem[] }

interface Props {
  order: OrderWithItems
  onUpdated: () => void
}

export default function USOrderDetailPanel({ order, onUpdated }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [carrier, setCarrier] = useState(order.carrier || '')
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number || '')
  const [shippingCost, setShippingCost] = useState(order.shipping_cost_usd?.toString() || '')

  async function updateOrder(updates: Record<string, unknown>) {
    setSaving(true)
    const res = await fetch(`/api/orders/us/${order.order_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    setSaving(false)
    if (res.ok) {
      onUpdated()
      router.refresh()
    }
  }

  function nextAction() {
    switch (order.status) {
      case 'pending':
        return (
          <button
            onClick={() => updateOrder({ status: 'packed' })}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
          >
            Mark Packed
          </button>
        )
      case 'packed':
        return (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              <select
                value={carrier}
                onChange={e => setCarrier(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
              >
                <option value="">Carrier...</option>
                {['USPS', 'FedEx', 'UPS', 'DHL'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="text"
                value={trackingNumber}
                onChange={e => setTrackingNumber(e.target.value)}
                placeholder="Tracking #"
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none col-span-1"
              />
              <input
                type="text"
                value={shippingCost}
                onChange={e => setShippingCost(e.target.value)}
                placeholder="Ship cost $"
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
              />
            </div>
            <button
              onClick={() => updateOrder({
                status: 'shipped',
                carrier,
                tracking_number: trackingNumber,
                shipping_cost_usd: shippingCost && Number.isFinite(parseFloat(shippingCost)) ? parseFloat(shippingCost) : undefined,
              })}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Mark Shipped
            </button>
          </div>
        )
      case 'shipped':
        return (
          <button
            onClick={() => updateOrder({ status: 'delivered' })}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            Mark Delivered
          </button>
        )
      default:
        return null
    }
  }

  const address = [
    order.ship_to_name,
    order.ship_to_address,
    [order.ship_to_city, order.ship_to_state, order.ship_to_zip].filter(Boolean).join(', '),
    order.ship_to_country,
  ].filter(Boolean).join('\n')

  return (
    <div className="bg-slate-50 border-t border-slate-200 px-8 py-4">
      <div className="grid grid-cols-3 gap-6">
        {/* Items */}
        <div>
          <h4 className="text-xs font-medium text-slate-500 mb-2">Order Items</h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400">
                <th className="text-left pb-1">SKU</th>
                <th className="text-right pb-1">Qty</th>
                <th className="text-right pb-1">Value</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map(item => (
                <tr key={item.item_id} className="text-slate-700">
                  <td className="py-0.5">{item.sku_name}</td>
                  <td className="text-right tabular-nums">{item.quantity}</td>
                  <td className="text-right tabular-nums">
                    {item.subtotal_usd != null ? `$${Number(item.subtotal_usd).toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 font-medium text-slate-900">
                <td className="pt-1">Total</td>
                <td />
                <td className="text-right tabular-nums pt-1">
                  {order.total_item_value_usd != null ? `$${Number(order.total_item_value_usd).toFixed(2)}` : '—'}
                </td>
              </tr>
              {order.shipping_cost_usd != null && (
                <tr className="text-slate-500">
                  <td>Shipping</td>
                  <td />
                  <td className="text-right tabular-nums">${Number(order.shipping_cost_usd).toFixed(2)}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        {/* Ship To */}
        <div>
          <h4 className="text-xs font-medium text-slate-500 mb-2">Ship To</h4>
          <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans">{address || '—'}</pre>
          {order.notes && (
            <div className="mt-3">
              <h4 className="text-xs font-medium text-slate-500 mb-1">Notes</h4>
              <p className="text-xs text-slate-600">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div>
          <h4 className="text-xs font-medium text-slate-500 mb-2">Actions</h4>
          <div className="space-y-3">
            {nextAction()}
            <a
              href={`/inventory/packing-slip/${order.order_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-white transition-colors w-fit"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Packing Slip
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
