'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ArrowRight, CheckCircle, Package, Clock } from 'lucide-react'
import NewTransferModal from './NewTransferModal'

interface InTransitLevel {
  inventory_level_id: string
  sku_id: string
  warehouse_id: string
  quantity: number
  in_transit_qty: number
  updated_at: string
  sku: { sku_name: string; sku_type: string; name_external_eng: string | null } | null
  warehouse: { name: string; short_code: string } | null
}

interface TransferTransaction {
  transaction_id: string
  transaction_ref: string | null
  sku_id: string
  qty_change: number
  movement_type: string
  carrier: string | null
  delivery_status: string | null
  date_shipped: string | null
  date_received: string | null
  created_at: string
  sku: { sku_name: string; name_external_eng: string | null } | null
  warehouse: { name: string; short_code: string } | null
}

interface Sku {
  sku_id: string
  sku_name: string
  sku_type: string
  name_external_eng: string | null
  product_id: string | null
}

interface Warehouse {
  warehouse_id: string
  name: string
  short_code: string
}

interface Props {
  inTransit: InTransitLevel[]
  recentTransfers: TransferTransaction[]
  skus: Sku[]
  warehouses: Warehouse[]
  canWrite: boolean
}

export default function LogisticsClient({ inTransit, recentTransfers, skus, warehouses, canWrite }: Props) {
  const router = useRouter()
  const [showNewTransfer, setShowNewTransfer] = useState(false)
  const [receivingId, setReceivingId] = useState<string | null>(null)
  const [receiveQty, setReceiveQty] = useState('')
  const [receiving, setReceiving] = useState(false)
  const [receiveError, setReceiveError] = useState('')

  const usWarehouse = warehouses.find(w => w.short_code === 'US')

  function startReceive(levelId: string, defaultQty: number) {
    setReceivingId(levelId)
    setReceiveQty(String(defaultQty))
    setReceiveError('')
  }

  function cancelReceive() {
    setReceivingId(null)
    setReceiveQty('')
    setReceiveError('')
  }

  async function confirmReceive(level: InTransitLevel) {
    const qty = parseInt(receiveQty, 10)
    if (!qty || qty <= 0) {
      setReceiveError('Enter a valid quantity')
      return
    }
    if (!usWarehouse) return

    setReceiving(true)
    setReceiveError('')

    const res = await fetch('/api/inventory/transfer/receive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku_id: level.sku_id,
        warehouse_id: usWarehouse.warehouse_id,
        quantity: qty,
      }),
    })

    if (!res.ok) {
      const json = await res.json()
      setReceiveError(json.error || 'Failed to receive')
      setReceiving(false)
      return
    }

    setReceivingId(null)
    setReceiveQty('')
    setReceiving(false)
    router.refresh()
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
        <div>
          <h1 className="text-2xl font-serif text-slate-900">Logistics</h1>
          <p className="text-xs text-slate-500 mt-0.5">JP → US warehouse transfers</p>
        </div>
        {canWrite && (
          <button
            onClick={() => setShowNewTransfer(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Transfer
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 py-5 space-y-8">

        {/* In Transit */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-slate-700">In Transit</h2>
            {inTransit.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {inTransit.length} SKU{inTransit.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {inTransit.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">No items currently in transit.</p>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">SKU</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Type</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">In Transit</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">On Hand (US)</th>
                    {canWrite && <th className="px-4 py-2.5" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inTransit.map((level) => (
                    <React.Fragment key={level.inventory_level_id}>
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{level.sku?.sku_name ?? '—'}</div>
                          {level.sku?.name_external_eng && (
                            <div className="text-xs text-slate-400">{level.sku.name_external_eng}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            level.sku?.sku_type === 'Product'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-green-50 text-green-700'
                          }`}>
                            {level.sku?.sku_type ?? 'Sample'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-amber-700">
                          {level.in_transit_qty}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500">{level.quantity}</td>
                        {canWrite && (
                          <td className="px-4 py-3 text-right">
                            {receivingId !== level.inventory_level_id && (
                              <button
                                onClick={() => startReceive(level.inventory_level_id, level.in_transit_qty)}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors ml-auto"
                              >
                                <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                                Receive
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                      {receivingId === level.inventory_level_id && canWrite && (
                        <tr className="bg-green-50 border-t border-green-100">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-xs text-slate-600">Quantity received:</span>
                              <input
                                type="number"
                                value={receiveQty}
                                onChange={e => setReceiveQty(e.target.value)}
                                min="1"
                                max={level.in_transit_qty}
                                className="w-20 text-sm border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-green-500"
                                autoFocus
                              />
                              {receiveError && <span className="text-xs text-red-500">{receiveError}</span>}
                              <button
                                onClick={() => confirmReceive(level)}
                                disabled={receiving}
                                className="px-3 py-1 text-xs font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
                              >
                                {receiving ? 'Saving...' : 'Confirm'}
                              </button>
                              <button
                                onClick={cancelReceive}
                                className="px-3 py-1 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Transfer History */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">Transfer History</h2>
          </div>

          {recentTransfers.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">No transfers yet.</p>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Date</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Ref</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">SKU</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Direction</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">Qty</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Carrier</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentTransfers.map((txn) => {
                    const isOut = txn.movement_type === 'transfer_jp_us_out'
                    const date = txn.date_shipped ?? txn.date_received ?? txn.created_at.split('T')[0]
                    return (
                      <tr key={txn.transaction_id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-500 tabular-nums">{date}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{txn.transaction_ref}</td>
                        <td className="px-4 py-2.5 text-slate-700">{txn.sku?.sku_name ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 text-xs ${isOut ? 'text-slate-500' : 'text-green-700'}`}>
                            <ArrowRight className="w-3 h-3" />
                            {isOut ? 'JP → US' : 'Received at US'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                          {Math.abs(txn.qty_change)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">{txn.carrier ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            txn.delivery_status === 'delivered'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {txn.delivery_status === 'delivered' ? 'Delivered' : 'In Transit'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {showNewTransfer && (
        <NewTransferModal
          skus={skus}
          onClose={() => setShowNewTransfer(false)}
        />
      )}
    </>
  )
}
