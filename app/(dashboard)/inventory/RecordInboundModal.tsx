'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Sku {
  sku_id: string
  sku_name: string
  product_id: string | null
  name_external_eng: string | null
  sku_type: string
}

interface Warehouse {
  warehouse_id: string
  name: string
  short_code: string
}

interface Props {
  skus: Sku[]
  warehouses: Warehouse[]
  onClose: () => void
}

export default function RecordInboundModal({ skus, warehouses, onClose }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [skuId, setSkuId] = useState('')
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find(w => w.short_code === 'JP')?.warehouse_id || '',
  )
  const [quantity, setQuantity] = useState('')
  const [transactionRef, setTransactionRef] = useState('')
  const [fromLocation, setFromLocation] = useState('')
  const [dateReceived, setDateReceived] = useState(
    new Date().toISOString().split('T')[0],
  )
  const [note, setNote] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!skuId || !warehouseId || !quantity) {
      setError('SKU, warehouse, and quantity are required')
      return
    }

    setSaving(true)
    setError('')

    const res = await fetch('/api/inventory/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku_id: skuId,
        warehouse_affected: warehouseId,
        movement_type: 'inbound_supplier_jp',
        qty_change: parseInt(quantity, 10),
        transaction_ref: transactionRef || undefined,
        from_location: fromLocation || 'Supplier',
        to_destination: warehouses.find(w => w.warehouse_id === warehouseId)?.name,
        date_received: dateReceived || undefined,
        item_type: skus.find(s => s.sku_id === skuId)?.sku_type || 'Sample',
        delivery_status: 'delivered',
        note: note || undefined,
      }),
    })

    if (!res.ok) {
      const json = await res.json()
      setError(json.error || 'Failed to save')
      setSaving(false)
      return
    }

    router.refresh()
    onClose()
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Inbound</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Transaction Ref</label>
            <input
              type="text"
              value={transactionRef}
              onChange={e => setTransactionRef(e.target.value)}
              placeholder="e.g. PO-6"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Supplier / Source</label>
            <input
              type="text"
              value={fromLocation}
              onChange={e => setFromLocation(e.target.value)}
              placeholder="e.g. Shinchaen"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">SKU *</label>
            <select
              value={skuId}
              onChange={e => setSkuId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
              required
            >
              <option value="">Select SKU...</option>
              {skus.map(s => (
                <option key={s.sku_id} value={s.sku_id}>
                  {s.sku_name} {s.name_external_eng ? `(${s.name_external_eng})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Warehouse *</label>
            <select
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
              required
            >
              {warehouses.map(w => (
                <option key={w.warehouse_id} value={w.warehouse_id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Quantity *</label>
            <input
              type="number"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              min="1"
              placeholder="Number of units"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date Received</label>
            <input
              type="date"
              value={dateReceived}
              onChange={e => setDateReceived(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Record Inbound'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
