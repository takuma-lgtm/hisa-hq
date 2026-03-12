'use client'

import { useEffect, useState } from 'react'
import { X, Plus, Trash2, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Product, ProposalWithItems, SampleBatchWithItems } from '@/types/database'

interface BatchItem {
  product_id: string
  product_snapshot: string
  qty_grams: string
  notes: string
}

interface Props {
  opportunityId: string
  customerId: string
  latestProposal: ProposalWithItems | null
  onSaved: (batch: SampleBatchWithItems) => void
  onClose: () => void
}

const CARRIERS = ['FedEx', 'UPS', 'USPS', 'DHL', 'Other']

export default function SampleBatchForm({
  opportunityId,
  customerId,
  latestProposal,
  onSaved,
  onClose,
}: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [carrier, setCarrier] = useState('FedEx')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [shipFrom] = useState('US Warehouse')
  const [shippedAt, setShippedAt] = useState(new Date().toISOString().slice(0, 16))
  const [items, setItems] = useState<BatchItem[]>([
    { product_id: '', product_snapshot: '', qty_grams: '', notes: '' },
  ])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('customer_facing_product_name')
      .then(({ data }) => { if (data) setProducts(data) })
  }, [])

  function addFromProposal() {
    if (!latestProposal) return
    const proposalItems: BatchItem[] = latestProposal.items.map((item) => ({
      product_id: item.product_id,
      product_snapshot: item.product.customer_facing_product_name,
      qty_grams: '',
      notes: '',
    }))
    setItems(proposalItems)
  }

  function addRow() {
    setItems((prev) => [...prev, { product_id: '', product_snapshot: '', qty_grams: '', notes: '' }])
  }

  function removeRow(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  function handleProductChange(i: number, productId: string) {
    const product = products.find((p) => p.product_id === productId)
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === i
          ? { ...item, product_id: productId, product_snapshot: product?.customer_facing_product_name ?? '' }
          : item,
      ),
    )
  }

  function updateRow(i: number, key: keyof BatchItem, value: string) {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [key]: value } : item))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validItems = items.filter((i) => i.product_id || i.product_snapshot)
    if (validItems.length === 0) {
      setError('Add at least one product to the batch.')
      return
    }

    setSaving(true)
    setError(null)

    const res = await fetch(`/api/opportunities/${opportunityId}/samples`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customerId,
        carrier,
        tracking_number: trackingNumber || null,
        ship_from: shipFrom,
        shipped_at: shippedAt,
        items: validItems.map((i) => ({
          product_id: i.product_id || null,
          product_snapshot: i.product_snapshot || null,
          qty_grams: i.qty_grams ? parseInt(i.qty_grams) : null,
          notes: i.notes || null,
        })),
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to create sample batch')
      setSaving(false)
      return
    }

    onSaved(data.batch)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-sm font-semibold text-gray-900">Create Sample Batch</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Carrier</label>
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="select-field"
              >
                {CARRIERS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Tracking number</label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Optional"
                className="input-field"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Ship from</label>
              <input
                type="text"
                value={shipFrom}
                readOnly
                className="input-field bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <label className="field-label">Shipped at</label>
              <input
                type="datetime-local"
                value={shippedAt}
                onChange={(e) => setShippedAt(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          {/* Products */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="field-label mb-0">Products</label>
              {latestProposal && latestProposal.items.length > 0 && (
                <button
                  type="button"
                  onClick={addFromProposal}
                  className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
                >
                  <Zap className="w-3 h-3" />
                  Add from latest proposal
                </button>
              )}
            </div>

            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <select
                    value={item.product_id}
                    onChange={(e) => handleProductChange(i, e.target.value)}
                    className="select-field flex-1"
                  >
                    <option value="">Select product…</option>
                    {products.map((p) => (
                      <option key={p.product_id} value={p.product_id}>
                        {p.customer_facing_product_name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={item.qty_grams}
                    onChange={(e) => updateRow(i, 'qty_grams', e.target.value)}
                    placeholder="g"
                    className="input-field w-16 shrink-0"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addRow}
              className="mt-2 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
            >
              <Plus className="w-3.5 h-3.5" />
              Add product
            </button>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create Batch'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .field-label { display: block; font-size: 0.75rem; font-weight: 500; color: #4b5563; margin-bottom: 0.25rem; }
        .input-field  { width: 100%; border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.375rem 0.625rem; font-size: 0.875rem; outline: none; }
        .input-field:focus { border-color: #fbbf24; box-shadow: 0 0 0 2px rgba(251,191,36,0.3); }
        .select-field { width: 100%; border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.375rem 0.625rem; font-size: 0.875rem; background: white; outline: none; }
        .select-field:focus { border-color: #fbbf24; box-shadow: 0 0 0 2px rgba(251,191,36,0.3); }
      `}</style>
    </div>
  )
}
