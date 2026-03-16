'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
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

interface TransferItem {
  sku_id: string
  quantity: string
}

interface Props {
  skus: Sku[]
  onClose: () => void
}

export default function RecordTransferModal({ skus, onClose }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [dateShipped, setDateShipped] = useState(() => new Date().toISOString().split('T')[0])
  const [carrier, setCarrier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [items, setItems] = useState<TransferItem[]>([{ sku_id: '', quantity: '' }])

  function addItem() {
    setItems([...items, { sku_id: '', quantity: '' }])
  }

  function removeItem(idx: number) {
    if (items.length === 1) return
    setItems(items.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof TransferItem, value: string) {
    const updated = [...items]
    updated[idx] = { ...updated[idx], [field]: value }
    setItems(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validItems = items.filter(i => i.sku_id && i.quantity && parseInt(i.quantity) > 0)
    if (validItems.length === 0) {
      setError('At least one SKU with quantity is required')
      return
    }

    setSaving(true)
    setError('')

    // Determine tracking field based on carrier
    const trackingFields: Record<string, string> = {}
    if (trackingNumber) {
      if (carrier === 'DHL') trackingFields.tracking_dhl = trackingNumber
      else if (carrier === 'FedEx') trackingFields.tracking_fedex = trackingNumber
      else if (carrier === 'USPS') trackingFields.tracking_usps = trackingNumber
      else if (carrier === 'UPS') trackingFields.tracking_ups = trackingNumber
    }

    for (const item of validItems) {
      const res = await fetch('/api/inventory/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku_id: item.sku_id,
          quantity: parseInt(item.quantity, 10),
          carrier: carrier || undefined,
          date_shipped: dateShipped || undefined,
          ...trackingFields,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        setError(json.error || 'Failed to save transfer')
        setSaving(false)
        return
      }
    }

    router.refresh()
    onClose()
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Transfer (JP → US)</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Multi-SKU rows */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Items to Transfer *</label>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={item.sku_id}
                    onChange={e => updateItem(idx, 'sku_id', e.target.value)}
                    className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">Select SKU...</option>
                    {skus.map(s => (
                      <option key={s.sku_id} value={s.sku_id}>
                        {s.sku_name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', e.target.value)}
                    min="1"
                    placeholder="Qty"
                    className="w-20 text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="p-1.5 text-slate-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="mt-2 flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
            >
              <Plus className="w-3.5 h-3.5" />
              Add another SKU
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date Shipped</label>
            <input
              type="date"
              value={dateShipped}
              onChange={e => setDateShipped(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Carrier</label>
              <select
                value={carrier}
                onChange={e => setCarrier(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select...</option>
                {['DHL', 'FedEx', 'USPS', 'UPS', 'Other'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tracking #</label>
              <input
                type="text"
                value={trackingNumber}
                onChange={e => setTrackingNumber(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
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
              {saving ? 'Saving...' : 'Record Transfer'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
