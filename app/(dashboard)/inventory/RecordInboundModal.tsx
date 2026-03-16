'use client'

import { useState, useMemo } from 'react'
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
  product: { supplier: string | null } | null
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

interface ProductOption {
  product_id: string
  label: string
  supplier: string | null
}

const PRODUCT_SIZES = ['1kg', '5kg', '10kg']
const SAMPLE_SIZES = ['30g', '20g', '10g']

function parseWeightKg(sizeLabel: string): number {
  const match = sizeLabel.match(/^(\d+(?:\.\d+)?)\s*(kg|g)$/i)
  if (!match) return 0
  const val = parseFloat(match[1])
  return match[2].toLowerCase() === 'g' ? val / 1000 : val
}

export default function RecordInboundModal({ skus, warehouses, onClose }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Step 1: Product
  const [productId, setProductId] = useState('')
  // Step 2: Type
  const [skuType, setSkuType] = useState<'Product' | 'Sample' | ''>('')
  // Step 3: Size
  const [sizeLabel, setSizeLabel] = useState('')
  const [customSize, setCustomSize] = useState('')

  // Other fields
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find(w => w.short_code === 'JP')?.warehouse_id || '',
  )
  const [quantity, setQuantity] = useState('')
  const [fromLocation, setFromLocation] = useState('')
  const [dateReceived, setDateReceived] = useState(
    new Date().toISOString().split('T')[0],
  )

  // Derive unique products from SKUs
  const products = useMemo(() => {
    const map = new Map<string, ProductOption>()
    for (const sku of skus) {
      if (!sku.product_id || map.has(sku.product_id)) continue
      map.set(sku.product_id, {
        product_id: sku.product_id,
        label: sku.name_external_eng
          ? `${sku.product_id} — ${sku.name_external_eng.replace(/\s*\d+[gk]g?\s*(Sample|Product|Bulk)?/i, '').trim()}`
          : sku.product_id,
        supplier: sku.product?.supplier ?? null,
      })
    }
    return Array.from(map.values()).sort((a, b) => a.product_id.localeCompare(b.product_id))
  }, [skus])

  // The effective size (from preset or custom input)
  const effectiveSize = sizeLabel === '__custom' ? customSize.trim() : sizeLabel

  // Resolve existing SKU
  const resolvedSkuName = productId && effectiveSize ? `${productId}_${effectiveSize}` : ''
  const existingSku = resolvedSkuName ? skus.find(s => s.sku_name === resolvedSkuName) : null
  const isNewSku = resolvedSkuName && !existingSku

  function handleProductChange(newProductId: string) {
    setProductId(newProductId)
    setSkuType('')
    setSizeLabel('')
    setCustomSize('')
    const product = products.find(p => p.product_id === newProductId)
    if (product?.supplier) {
      setFromLocation(product.supplier)
    } else {
      setFromLocation('')
    }
  }

  function handleTypeChange(newType: 'Product' | 'Sample') {
    setSkuType(newType)
    setSizeLabel('')
    setCustomSize('')
  }

  const presetSizes = skuType === 'Product' ? PRODUCT_SIZES : skuType === 'Sample' ? SAMPLE_SIZES : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId || !skuType || !effectiveSize || !warehouseId || !quantity) {
      setError('All fields are required')
      return
    }

    setSaving(true)
    setError('')

    let finalSkuId = existingSku?.sku_id

    // Auto-create SKU if it doesn't exist
    if (!finalSkuId) {
      const createRes = await fetch('/api/skus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku_name: resolvedSkuName,
          product_id: productId,
          sku_type: skuType,
          unit_weight_kg: parseWeightKg(effectiveSize),
          name_external_eng: `${productId} ${effectiveSize} ${skuType}`,
          is_active: true,
        }),
      })

      if (!createRes.ok) {
        const json = await createRes.json()
        setError(json.error || 'Failed to create SKU')
        setSaving(false)
        return
      }

      const created = await createRes.json()
      finalSkuId = created.sku_id
    }

    // Record the transaction
    const res = await fetch('/api/inventory/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku_id: finalSkuId,
        warehouse_affected: warehouseId,
        movement_type: 'inbound_supplier_jp',
        qty_change: parseInt(quantity, 10),
        from_location: fromLocation || 'Supplier',
        to_destination: warehouses.find(w => w.warehouse_id === warehouseId)?.name,
        date_received: dateReceived || undefined,
        item_type: skuType,
        delivery_status: 'delivered',
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

  const inputClass = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500'

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Inventory</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: Product */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Product *</label>
            <select
              value={productId}
              onChange={e => handleProductChange(e.target.value)}
              className={inputClass}
              required
            >
              <option value="">Select product...</option>
              {products.map(p => (
                <option key={p.product_id} value={p.product_id}>{p.product_id}</option>
              ))}
            </select>
          </div>

          {/* Step 2: Type */}
          {productId && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Type *</label>
              <div className="flex gap-2">
                {(['Product', 'Sample'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTypeChange(t)}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      skuType === t
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Size */}
          {productId && skuType && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Size *</label>
              <div className="flex flex-wrap gap-2">
                {presetSizes.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setSizeLabel(s); setCustomSize('') }}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                      sizeLabel === s
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSizeLabel('__custom')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                    sizeLabel === '__custom'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Custom
                </button>
              </div>
              {sizeLabel === '__custom' && (
                <input
                  type="text"
                  value={customSize}
                  onChange={e => setCustomSize(e.target.value)}
                  placeholder="e.g. 50g, 500g, 2kg"
                  className={`${inputClass} mt-2`}
                  autoFocus
                />
              )}
              {isNewSku && effectiveSize && (
                <p className="text-xs text-amber-600 mt-1.5">
                  New SKU <span className="font-medium">{resolvedSkuName}</span> will be created
                </p>
              )}
              {existingSku && (
                <p className="text-xs text-green-600 mt-1.5">
                  Existing SKU: <span className="font-medium">{existingSku.sku_name}</span>
                </p>
              )}
            </div>
          )}

          {/* Remaining fields — show after SKU is fully resolved */}
          {productId && skuType && effectiveSize && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Supplier / Source</label>
                <input
                  type="text"
                  value={fromLocation}
                  onChange={e => setFromLocation(e.target.value)}
                  placeholder="Auto-filled from product"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Warehouse *</label>
                <select
                  value={warehouseId}
                  onChange={e => setWarehouseId(e.target.value)}
                  className={inputClass}
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
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date Received</label>
                <input
                  type="date"
                  value={dateReceived}
                  onChange={e => setDateReceived(e.target.value)}
                  className={inputClass}
                />
              </div>
            </>
          )}

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
              disabled={saving || !productId || !skuType || !effectiveSize}
              className="px-4 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Record Inventory'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
