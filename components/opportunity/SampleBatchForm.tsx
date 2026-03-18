'use client'

import { useEffect, useState } from 'react'
import { X, Plus, Trash2, Zap, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Product, ProposalWithItems, SampleBatchWithItems } from '@/types/database'

interface BatchItem {
  product_id: string
  product_snapshot: string
  qty_grams: string
  sku_id: string
  notes: string
}

interface SampleSku {
  sku_id: string
  sku_name: string
  unit_weight_kg: number | null
  product_id: string | null
}

interface Warehouse {
  warehouse_id: string
  name: string
  short_code: string
}

interface StockLevel {
  sku_id: string
  quantity: number
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
  const [sampleSkus, setSampleSkus] = useState<SampleSku[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [carrier, setCarrier] = useState('FedEx')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [route, setRoute] = useState<'us' | 'jp'>('us')
  const [shippedAt, setShippedAt] = useState(new Date().toISOString().slice(0, 16))
  const [items, setItems] = useState<BatchItem[]>([
    { product_id: '', product_snapshot: '', qty_grams: '', sku_id: '', notes: '' },
  ])

  const selectedWarehouse = route === 'us'
    ? warehouses.find(w => w.short_code === 'US')
    : warehouses.find(w => w.short_code === 'JP')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('products').select('*').eq('active', true).order('customer_facing_product_name'),
      supabase.from('skus').select('sku_id, sku_name, sku_type, unit_weight_kg, product_id').eq('is_active', true).eq('sku_type', 'Sample').order('sku_name'),
      supabase.from('warehouse_locations').select('warehouse_id, name, short_code').eq('is_active', true),
    ]).then(([prodRes, skuRes, whRes]) => {
      if (prodRes.data) setProducts(prodRes.data)
      if (skuRes.data) setSampleSkus(skuRes.data as SampleSku[])
      if (whRes.data) setWarehouses(whRes.data)
    })
  }, [])

  // Fetch stock levels when warehouse changes
  useEffect(() => {
    if (!selectedWarehouse) return
    const supabase = createClient()
    supabase
      .from('inventory_levels')
      .select('sku_id, quantity')
      .eq('warehouse_id', selectedWarehouse.warehouse_id)
      .then(({ data }) => {
        if (data) setStockLevels(data.map(d => ({ sku_id: d.sku_id, quantity: d.quantity })))
      })
  }, [selectedWarehouse?.warehouse_id])

  function getStock(skuId: string): number | null {
    if (!skuId || !selectedWarehouse) return null
    const level = stockLevels.find(l => l.sku_id === skuId)
    return level?.quantity ?? 0
  }

  function addFromProposal() {
    if (!latestProposal) return
    const proposalItems: BatchItem[] = latestProposal.items.map((item) => ({
      product_id: item.product_id,
      product_snapshot: item.product.customer_facing_product_name,
      qty_grams: '',
      sku_id: '',
      notes: '',
    }))
    setItems(proposalItems)
  }

  function addRow() {
    setItems((prev) => [...prev, { product_id: '', product_snapshot: '', qty_grams: '', sku_id: '', notes: '' }])
  }

  function removeRow(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  function handleProductChange(i: number, productId: string) {
    const product = products.find((p) => p.product_id === productId)
    // Auto-select SKU if only one Sample SKU matches this product
    const matchingSkus = sampleSkus.filter(s => s.product_id === productId)
    const autoSku = matchingSkus.length === 1 ? matchingSkus[0].sku_id : ''
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === i
          ? { ...item, product_id: productId, product_snapshot: product?.customer_facing_product_name ?? '', sku_id: autoSku }
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
        ship_from: selectedWarehouse?.name ?? (route === 'us' ? 'US Warehouse' : 'JP Warehouse'),
        ship_from_warehouse_id: selectedWarehouse?.warehouse_id ?? null,
        shipped_at: shippedAt,
        items: validItems.map((i) => ({
          product_id: i.product_id || null,
          product_snapshot: i.product_snapshot || null,
          qty_grams: i.qty_grams ? parseInt(i.qty_grams) : null,
          sku_id: i.sku_id || null,
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

          {/* Route selector */}
          <div>
            <label className="field-label">Ship from</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setRoute('us')}
                className={`flex-1 py-1.5 text-xs font-medium transition-colors ${route === 'us' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                US Warehouse
              </button>
              <button
                type="button"
                onClick={() => setRoute('jp')}
                className={`flex-1 py-1.5 text-xs font-medium transition-colors ${route === 'jp' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                JP Direct
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {route === 'us' ? 'Ship from US warehouse stock to the cafe.' : 'Ship directly from Japan to the cafe (international or expedited).'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Carrier</label>
              <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="select-field">
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

          <div>
            <label className="field-label">Shipped at</label>
            <input
              type="datetime-local"
              value={shippedAt}
              onChange={(e) => setShippedAt(e.target.value)}
              className="input-field"
            />
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

            <div className="space-y-3">
              {items.map((item, i) => {
                const stock = getStock(item.sku_id)
                const qty = item.qty_grams ? parseInt(item.qty_grams) : 0
                const lowStock = item.sku_id && stock !== null && qty > 0 && stock < qty
                const noStock = item.sku_id && stock !== null && stock === 0
                const skusForProduct = item.product_id ? sampleSkus.filter(s => s.product_id === item.product_id) : sampleSkus

                return (
                  <div key={i} className="space-y-1.5 pb-2 border-b border-gray-100 last:border-0">
                    <div className="flex gap-2 items-start">
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

                    {/* SKU selector for inventory tracking */}
                    <div className="flex items-center gap-2 pl-0.5">
                      <select
                        value={item.sku_id}
                        onChange={(e) => updateRow(i, 'sku_id', e.target.value)}
                        className="select-field flex-1 text-xs text-slate-500"
                      >
                        <option value="">Sample SKU (for inventory tracking)…</option>
                        {skusForProduct.map((s) => (
                          <option key={s.sku_id} value={s.sku_id}>{s.sku_name}</option>
                        ))}
                      </select>
                      {item.sku_id && stock !== null && (
                        <span className={`text-[11px] shrink-0 ${noStock ? 'text-red-600 font-medium' : lowStock ? 'text-amber-600' : 'text-slate-400'}`}>
                          {stock} in stock
                        </span>
                      )}
                    </div>

                    {/* Stock warning */}
                    {(lowStock || noStock) && (
                      <div className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded ${noStock ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        {noStock
                          ? `No stock in ${route === 'us' ? 'US' : 'JP'} warehouse. Transfer stock before shipping.`
                          : `Only ${stock} available — you requested ${qty}.`
                        }
                      </div>
                    )}
                  </div>
                )
              })}
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
