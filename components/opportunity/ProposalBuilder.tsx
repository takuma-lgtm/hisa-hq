'use client'

import { useEffect, useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Product, ProposalWithItems } from '@/types/database'

interface ProposalItem {
  product_id: string
  price_per_kg: string
  currency: string
  notes: string
}

interface Props {
  opportunityId: string
  userId: string
  onSaved: (proposal: ProposalWithItems) => void
  onClose: () => void
}

const SENT_VIA_OPTIONS = [
  { value: 'ig', label: 'Instagram DM' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
  { value: 'other', label: 'Other' },
]

export default function ProposalBuilder({ opportunityId, userId, onSaved, onClose }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentVia, setSentVia] = useState('ig')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<ProposalItem[]>([
    { product_id: '', price_per_kg: '', currency: 'USD', notes: '' },
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

  function addRow() {
    setItems((prev) => [...prev, { product_id: '', price_per_kg: '', currency: 'USD', notes: '' }])
  }

  function removeRow(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateRow(i: number, key: keyof ProposalItem, value: string) {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [key]: value } : item))
  }

  // Pre-fill price from product's default_selling_price_usd when product is selected
  function handleProductChange(i: number, productId: string) {
    const product = products.find((p) => p.product_id === productId)
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === i
          ? {
              ...item,
              product_id: productId,
              price_per_kg: product?.default_selling_price_usd
                ? String(product.default_selling_price_usd)
                : item.price_per_kg,
            }
          : item,
      ),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validItems = items.filter((i) => i.product_id && i.price_per_kg)
    if (validItems.length === 0) {
      setError('Add at least one product with a price.')
      return
    }

    setSaving(true)
    setError(null)

    const res = await fetch(`/api/opportunities/${opportunityId}/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sent_via: sentVia,
        notes: notes || null,
        default_currency: 'USD',
        created_by: userId,
        items: validItems.map((i) => ({
          product_id: i.product_id,
          price_per_kg: parseFloat(i.price_per_kg),
          currency: i.currency,
          notes: i.notes || null,
        })),
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to save proposal')
      setSaving(false)
      return
    }

    onSaved(data.proposal)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-sm font-semibold text-gray-900">Create Proposal</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Send via</label>
              <select
                value={sentVia}
                onChange={(e) => setSentVia(e.target.value)}
                className="select-field"
              >
                {SENT_VIA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                className="input-field"
              />
            </div>
          </div>

          {/* Line items */}
          <div>
            <label className="field-label mb-2 block">Products & Prices</label>
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
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.price_per_kg}
                      onChange={(e) => updateRow(i, 'price_per_kg', e.target.value)}
                      placeholder="Price/kg"
                      className="input-field w-24"
                    />
                  </div>
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
              className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Proposal'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .field-label { display: block; font-size: 0.75rem; font-weight: 500; color: #4b5563; margin-bottom: 0.25rem; }
        .input-field  { width: 100%; border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.375rem 0.625rem; font-size: 0.875rem; outline: none; }
        .input-field:focus { border-color: #a78bfa; box-shadow: 0 0 0 2px rgba(167,139,250,0.3); }
        .select-field { width: 100%; border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.375rem 0.625rem; font-size: 0.875rem; background: white; outline: none; }
        .select-field:focus { border-color: #a78bfa; box-shadow: 0 0 0 2px rgba(167,139,250,0.3); }
      `}</style>
    </div>
  )
}
