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

export default function ManualAdjustmentModal({ skus, warehouses, onClose }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [skuId, setSkuId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [qtyChange, setQtyChange] = useState('')
  const [note, setNote] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const qty = parseInt(qtyChange, 10)
    if (!skuId || !warehouseId || !qty || qty === 0) {
      setError('SKU, warehouse, and non-zero quantity are required')
      return
    }
    if (!note.trim()) {
      setError('Reason is required for manual adjustments')
      return
    }

    setSaving(true)
    setError('')

    const res = await fetch('/api/inventory/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku_id: skuId,
        warehouse_id: warehouseId,
        qty_change: qty,
        note: note.trim(),
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
          <DialogTitle>Manual Stock Adjustment</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              <option value="">Select warehouse...</option>
              {warehouses.map(w => (
                <option key={w.warehouse_id} value={w.warehouse_id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Quantity Change * <span className="text-slate-400 font-normal">(positive to add, negative to remove)</span>
            </label>
            <input
              type="number"
              value={qtyChange}
              onChange={e => setQtyChange(e.target.value)}
              placeholder="e.g. -5 or +10"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Reason *</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Why is this adjustment being made?"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500 resize-none"
              required
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
              className="px-4 py-1.5 text-sm rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Adjustment'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
