'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Product, PricingTier } from '@/types/database'

interface Props {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (product: Product) => void
}

interface TierDraft {
  tier_name: string
  currency: string
  min_volume_kg: string
  discount_pct: string
  price_per_kg: string
}

const EMPTY_TIER: TierDraft = {
  tier_name: '',
  currency: 'USD',
  min_volume_kg: '0',
  discount_pct: '0',
  price_per_kg: '0',
}

export default function ProductEditModal({ product, open, onOpenChange, onSaved }: Props) {
  const router = useRouter()
  const isCreate = !product
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [productId, setProductId] = useState('')
  const [externalName, setExternalName] = useState('')
  const [jpnName, setJpnName] = useState('')
  const [supplier, setSupplier] = useState('')
  const [productType, setProductType] = useState('')
  const [active, setActive] = useState(true)
  const [costJpy, setCostJpy] = useState('')
  const [landingUsd, setLandingUsd] = useState('')
  const [landingGbp, setLandingGbp] = useState('')
  const [landingEur, setLandingEur] = useState('')
  const [priceUsd, setPriceUsd] = useState('')
  const [minUsd, setMinUsd] = useState('')
  const [priceGbp, setPriceGbp] = useState('')
  const [minGbp, setMinGbp] = useState('')
  const [priceEur, setPriceEur] = useState('')
  const [minEur, setMinEur] = useState('')
  const [profitUsd, setProfitUsd] = useState('')
  const [margin, setMargin] = useState('')
  const [stockKg, setStockKg] = useState('')
  const [notes, setNotes] = useState('')

  // Pricing tiers
  const [tiers, setTiers] = useState<TierDraft[]>([])
  const [tiersLoaded, setTiersLoaded] = useState(false)

  const resetForm = useCallback(() => {
    if (product) {
      setProductId(product.product_id)
      setExternalName(product.customer_facing_product_name || '')
      setJpnName(product.name_internal_jpn || product.supplier_product_name || '')
      setSupplier(product.supplier || '')
      setProductType(product.product_type || '')
      setActive(product.active)
      setCostJpy(product.matcha_cost_per_kg_jpy?.toString() || '')
      setLandingUsd((product.us_landing_cost_per_kg_usd ?? product.landing_cost_per_kg_usd)?.toString() || '')
      setLandingGbp(product.uk_landing_cost_per_kg_gbp?.toString() || '')
      setLandingEur(product.eu_landing_cost_per_kg_eur?.toString() || '')
      setPriceUsd((product.selling_price_usd ?? product.default_selling_price_usd)?.toString() || '')
      setMinUsd((product.min_price_usd ?? product.min_selling_price_usd)?.toString() || '')
      setPriceGbp(product.selling_price_gbp?.toString() || '')
      setMinGbp(product.min_price_gbp?.toString() || '')
      setPriceEur(product.selling_price_eur?.toString() || '')
      setMinEur(product.min_price_eur?.toString() || '')
      setProfitUsd(product.gross_profit_per_kg_usd?.toString() || '')
      setMargin(product.gross_profit_margin ? (product.gross_profit_margin * 100).toFixed(1) : '')
      setStockKg(product.monthly_available_stock_kg?.toString() || '')
      setNotes(product.tasting_notes || '')
    } else {
      setProductId('')
      setExternalName('')
      setJpnName('')
      setSupplier('')
      setProductType('Matcha')
      setActive(true)
      setCostJpy('')
      setLandingUsd('')
      setLandingGbp('')
      setLandingEur('')
      setPriceUsd('')
      setMinUsd('')
      setPriceGbp('')
      setMinGbp('')
      setPriceEur('')
      setMinEur('')
      setProfitUsd('')
      setMargin('')
      setStockKg('')
      setNotes('')
      setTiers([])
      setTiersLoaded(false)
    }
    setError(null)
  }, [product])

  useEffect(() => {
    if (open) resetForm()
  }, [open, resetForm])

  // Load tiers when editing
  useEffect(() => {
    if (!open || !product || tiersLoaded) return
    fetch(`/api/products/${encodeURIComponent(product.product_id)}/tiers`)
      .then((r) => r.json())
      .then((data: PricingTier[]) => {
        setTiers(
          data.map((t) => ({
            tier_name: t.tier_name,
            currency: t.currency,
            min_volume_kg: t.min_volume_kg.toString(),
            discount_pct: t.discount_pct.toString(),
            price_per_kg: t.price_per_kg.toString(),
          })),
        )
        setTiersLoaded(true)
      })
      .catch(() => setTiersLoaded(true))
  }, [open, product, tiersLoaded])

  function numOrNull(val: string): number | null {
    if (!val.trim()) return null
    const n = parseFloat(val)
    return isNaN(n) ? null : n
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const sellingUsd = numOrNull(priceUsd)
    const marginDec = numOrNull(margin) != null ? numOrNull(margin)! / 100 : null

    const body: Record<string, unknown> = {
      customer_facing_product_name: externalName || productId,
      supplier_product_name: jpnName || productId,
      name_internal_jpn: jpnName || null,
      supplier: supplier || null,
      product_type: productType || null,
      active,
      matcha_cost_per_kg_jpy: numOrNull(costJpy),
      us_landing_cost_per_kg_usd: numOrNull(landingUsd),
      landing_cost_per_kg_usd: numOrNull(landingUsd),
      uk_landing_cost_per_kg_gbp: numOrNull(landingGbp),
      eu_landing_cost_per_kg_eur: numOrNull(landingEur),
      selling_price_usd: sellingUsd,
      default_selling_price_usd: sellingUsd,
      price_per_kg: sellingUsd ?? 0,
      min_price_usd: numOrNull(minUsd),
      min_selling_price_usd: numOrNull(minUsd),
      selling_price_gbp: numOrNull(priceGbp),
      min_price_gbp: numOrNull(minGbp),
      selling_price_eur: numOrNull(priceEur),
      min_price_eur: numOrNull(minEur),
      gross_profit_per_kg_usd: numOrNull(profitUsd),
      gross_profit_margin: marginDec,
      monthly_available_stock_kg: numOrNull(stockKg) != null ? Math.round(numOrNull(stockKg)!) : null,
      tasting_notes: notes || null,
    }

    try {
      let url: string
      let method: string

      if (isCreate) {
        body.product_id = productId
        url = '/api/products'
        method = 'POST'
      } else {
        url = `/api/products/${encodeURIComponent(product.product_id)}`
        method = 'PATCH'
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Save failed')
      }

      const saved: Product = await res.json()

      // Save tiers
      const pid = saved.product_id
      const validTiers = tiers.filter((t) => t.tier_name.trim() && numOrNull(t.price_per_kg) != null)
      if (validTiers.length > 0) {
        await fetch(`/api/products/${encodeURIComponent(pid)}/tiers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            validTiers.map((t) => ({
              tier_name: t.tier_name,
              currency: t.currency,
              min_volume_kg: numOrNull(t.min_volume_kg) ?? 0,
              discount_pct: numOrNull(t.discount_pct) ?? 0,
              price_per_kg: numOrNull(t.price_per_kg) ?? 0,
            })),
          ),
        })
      }

      onSaved(saved)
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function addTier() {
    setTiers((prev) => [...prev, { ...EMPTY_TIER }])
  }

  function removeTier(idx: number) {
    setTiers((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateTier(idx: number, field: keyof TierDraft, value: string) {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isCreate ? 'Add Product' : `Edit ${product?.customer_facing_product_name || product?.product_id}`}</DialogTitle>
          <DialogDescription>
            {isCreate ? 'Create a new product in the catalog.' : 'Update product details and pricing.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-slate-700">Basic Info</legend>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Product ID" required>
                <input
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  disabled={!isCreate}
                  required
                  className="input"
                  placeholder="e.g. SC-3"
                />
              </Field>
              <Field label="External Name">
                <input
                  value={externalName}
                  onChange={(e) => setExternalName(e.target.value)}
                  className="input"
                  placeholder="e.g. Kai Matcha"
                />
              </Field>
              <Field label="Internal JPN Name">
                <input value={jpnName} onChange={(e) => setJpnName(e.target.value)} className="input" />
              </Field>
              <Field label="Supplier">
                <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className="input" />
              </Field>
              <Field label="Type">
                <select value={productType} onChange={(e) => setProductType(e.target.value)} className="input">
                  <option value="">—</option>
                  <option value="Matcha">Matcha</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Active">
                <label className="flex items-center gap-2 mt-1">
                  <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-slate-300" />
                  <span className="text-sm text-slate-600">{active ? 'Active' : 'Inactive'}</span>
                </label>
              </Field>
            </div>
          </fieldset>

          {/* Cost */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-slate-700">Cost Structure</legend>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Matcha Cost (¥/kg)">
                <input type="number" step="any" value={costJpy} onChange={(e) => setCostJpy(e.target.value)} className="input" />
              </Field>
              <Field label="US Landing Cost ($/kg)">
                <input type="number" step="any" value={landingUsd} onChange={(e) => setLandingUsd(e.target.value)} className="input" />
              </Field>
              <Field label="UK Landing Cost (£/kg)">
                <input type="number" step="any" value={landingGbp} onChange={(e) => setLandingGbp(e.target.value)} className="input" />
              </Field>
              <Field label="EU Landing Cost (€/kg)">
                <input type="number" step="any" value={landingEur} onChange={(e) => setLandingEur(e.target.value)} className="input" />
              </Field>
            </div>
          </fieldset>

          {/* Pricing */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-slate-700">Selling Prices</legend>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Price ($/kg)">
                <input type="number" step="any" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} className="input" />
              </Field>
              <Field label="Min ($/kg)">
                <input type="number" step="any" value={minUsd} onChange={(e) => setMinUsd(e.target.value)} className="input" />
              </Field>
              <Field label="Profit ($/kg)">
                <input type="number" step="any" value={profitUsd} onChange={(e) => setProfitUsd(e.target.value)} className="input" />
              </Field>
              <Field label="Price (£/kg)">
                <input type="number" step="any" value={priceGbp} onChange={(e) => setPriceGbp(e.target.value)} className="input" />
              </Field>
              <Field label="Min (£/kg)">
                <input type="number" step="any" value={minGbp} onChange={(e) => setMinGbp(e.target.value)} className="input" />
              </Field>
              <Field label="Margin (%)">
                <input type="number" step="any" value={margin} onChange={(e) => setMargin(e.target.value)} className="input" placeholder="e.g. 55" />
              </Field>
              <Field label="Price (€/kg)">
                <input type="number" step="any" value={priceEur} onChange={(e) => setPriceEur(e.target.value)} className="input" />
              </Field>
              <Field label="Min (€/kg)">
                <input type="number" step="any" value={minEur} onChange={(e) => setMinEur(e.target.value)} className="input" />
              </Field>
              <Field label="Stock/month (kg)">
                <input type="number" step="1" value={stockKg} onChange={(e) => setStockKg(e.target.value)} className="input" />
              </Field>
            </div>
          </fieldset>

          {/* Notes */}
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="input resize-none"
            />
          </Field>

          {/* Pricing Tiers */}
          <fieldset className="space-y-3">
            <div className="flex items-center justify-between">
              <legend className="text-sm font-semibold text-slate-700">Volume Pricing Tiers</legend>
              <button type="button" onClick={addTier} className="text-xs text-green-700 hover:text-green-800 font-medium">
                + Add tier
              </button>
            </div>
            {tiers.length > 0 && (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_80px_80px_80px_100px_32px] gap-2 text-[10px] text-slate-500 uppercase tracking-wide px-1">
                  <span>Name</span><span>Currency</span><span>Min kg</span><span>Disc %</span><span>Price/kg</span><span />
                </div>
                {tiers.map((t, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_80px_80px_100px_32px] gap-2">
                    <input value={t.tier_name} onChange={(e) => updateTier(i, 'tier_name', e.target.value)} className="input text-xs" placeholder="Standard" />
                    <select value={t.currency} onChange={(e) => updateTier(i, 'currency', e.target.value)} className="input text-xs">
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                      <option value="EUR">EUR</option>
                    </select>
                    <input type="number" step="any" value={t.min_volume_kg} onChange={(e) => updateTier(i, 'min_volume_kg', e.target.value)} className="input text-xs" />
                    <input type="number" step="any" value={t.discount_pct} onChange={(e) => updateTier(i, 'discount_pct', e.target.value)} className="input text-xs" />
                    <input type="number" step="any" value={t.price_per_kg} onChange={(e) => updateTier(i, 'price_per_kg', e.target.value)} className="input text-xs" />
                    <button type="button" onClick={() => removeTier(i)} className="text-slate-400 hover:text-red-500 text-sm">×</button>
                  </div>
                ))}
              </div>
            )}
          </fieldset>

          {/* Error */}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || (!isCreate && !product)}>
              {saving ? 'Saving...' : isCreate ? 'Create Product' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  )
}
