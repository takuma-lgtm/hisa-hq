'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ExternalLink, Camera } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { getMarginHealth, type MarginThresholds } from '@/lib/margin-health'
import type { Product, PricingTier } from '@/types/database'
import TastingLogTab from './TastingLogTab'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  product: Product | null // null = create mode
  isCompetitor: boolean
  isAdmin: boolean
  marginThresholds: MarginThresholds
  onClose: () => void
  onSaved: (product: Product) => void
}

type PanelTab = 'profile' | 'pricing' | 'tasting'

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ProductSidePanel({
  product,
  isCompetitor,
  isAdmin,
  marginThresholds,
  onClose,
  onSaved,
}: Props) {
  const [panelTab, setPanelTab] = useState<PanelTab>('profile')
  const [localProduct, setLocalProduct] = useState<Product | null>(product)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync local state from prop
    setLocalProduct(product)
    setPanelTab('profile')
  }, [product])

  // Create mode
  if (!localProduct) {
    return (
      <CreateForm
        isCompetitor={isCompetitor}
        onClose={onClose}
        onCreated={(p) => {
          setLocalProduct(p)
          onSaved(p)
        }}
      />
    )
  }

  const showPricing = !localProduct.is_competitor
  const tabs: { key: PanelTab; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    ...(showPricing ? [{ key: 'pricing' as PanelTab, label: 'Pricing' }] : []),
    { key: 'tasting', label: 'Tasting Log' },
  ]

  function handleFieldSaved(updated: Product) {
    setLocalProduct(updated)
    onSaved(updated)
  }

  return (
    <div className="w-[440px] shrink-0 border-l border-slate-200 flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 mr-2">
            <h2 className="text-sm font-semibold text-slate-900 truncate">
              {localProduct.customer_facing_product_name}
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">{localProduct.product_id}</p>
            {localProduct.tasting_headline && (
              <p className="text-xs italic text-slate-500 mt-0.5">{localProduct.tasting_headline}</p>
            )}
            {localProduct.is_competitor && localProduct.competitor_producer && (
              <p className="text-[10px] text-slate-500 mt-1">
                by {localProduct.competitor_producer}
                {localProduct.competitor_url && (
                  <>
                    {' · '}
                    <a
                      href={localProduct.competitor_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:text-green-700 inline-flex items-center gap-0.5"
                    >
                      View product <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 mt-0.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Inner tabs */}
        <div className="flex gap-4 mt-3 -mb-px">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setPanelTab(t.key)}
              className={`pb-2 text-xs font-medium border-b-2 transition-colors ${
                panelTab === t.key
                  ? 'border-slate-800 text-slate-800'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {panelTab === 'profile' && (
          <ProfileTab
            product={localProduct}
            isAdmin={isAdmin}
            onSaved={handleFieldSaved}
          />
        )}
        {panelTab === 'pricing' && showPricing && (
          <PricingTab
            product={localProduct}
            isAdmin={isAdmin}
            marginThresholds={marginThresholds}
            onSaved={handleFieldSaved}
          />
        )}
        {panelTab === 'tasting' && (
          <TastingLogTab productId={localProduct.product_id} isAdmin={isAdmin} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline Editable Field
// ---------------------------------------------------------------------------

function InlineField({
  label,
  value,
  field,
  productId,
  isAdmin,
  type = 'text',
  onSaved,
}: {
  label: string
  value: string | null
  field: string
  productId: string
  isAdmin: boolean
  type?: 'text' | 'textarea'
  onSaved: (updated: Product) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync draft from prop
    setDraft(value ?? '')
    setEditing(false)
  }, [value])

  async function save() {
    if (draft === (value ?? '')) {
      setEditing(false)
      return
    }
    setSaving(true)
    const res = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: draft.trim() || null }),
    })
    if (res.ok) {
      const updated = await res.json()
      onSaved(updated)
    }
    setSaving(false)
    setEditing(false)
  }

  if (!isAdmin) {
    return (
      <div className="py-1">
        <span className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</span>
        {type === 'textarea' ? (
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{value || '—'}</p>
        ) : (
          <p className="text-sm text-slate-700">{value || '—'}</p>
        )}
      </div>
    )
  }

  if (!editing) {
    return (
      <div className="py-1 cursor-pointer group" onClick={() => setEditing(true)}>
        <span className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</span>
        {type === 'textarea' ? (
          <p className="text-sm text-slate-700 whitespace-pre-wrap group-hover:bg-green-50/50 rounded px-1 -mx-1 transition-colors">
            {value || <span className="text-slate-300 italic">Click to add...</span>}
          </p>
        ) : (
          <p className="text-sm text-slate-700 group-hover:bg-green-50/50 rounded px-1 -mx-1 transition-colors">
            {value || <span className="text-slate-300 italic">Click to add...</span>}
          </p>
        )}
      </div>
    )
  }

  const inputClass = 'w-full text-sm border border-slate-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-slate-400'

  return (
    <div className="py-1">
      <span className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</span>
      {type === 'textarea' ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) } }}
          className={`${inputClass} resize-none`}
          rows={3}
          disabled={saving}
        />
      ) : (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
          }}
          className={inputClass}
          disabled={saving}
        />
      )}
      {saving && <span className="text-[10px] text-green-600">Saving...</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline Numeric Field
// ---------------------------------------------------------------------------

function InlineNumericField({
  label,
  value,
  field,
  productId,
  isAdmin,
  format,
  onSaved,
}: {
  label: string
  value: number | null
  field: string
  productId: string
  isAdmin: boolean
  format: (v: number | null) => string
  onSaved: (updated: Product) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value != null ? String(value) : '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync draft from prop
    setDraft(value != null ? String(value) : '')
    setEditing(false)
  }, [value])

  async function save() {
    const parsed = draft.trim() ? Number(draft) : null
    if (parsed === value) { setEditing(false); return }
    setSaving(true)
    const res = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: parsed }),
    })
    if (res.ok) onSaved(await res.json())
    setSaving(false)
    setEditing(false)
  }

  if (!isAdmin || !editing) {
    return (
      <div
        className={`flex items-center justify-between py-1 ${isAdmin ? 'cursor-pointer group' : ''}`}
        onClick={() => isAdmin && setEditing(true)}
      >
        <span className="text-xs text-slate-500">{label}</span>
        <span className={`text-sm text-slate-700 tabular-nums ${isAdmin ? 'group-hover:bg-green-50/50 rounded px-1 transition-colors' : ''}`}>
          {format(value)}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-slate-500">{label}</span>
      <input
        autoFocus
        type="number"
        step="any"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') { setDraft(value != null ? String(value) : ''); setEditing(false) }
        }}
        className="w-28 text-sm text-right border border-slate-300 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-slate-400"
        disabled={saving}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Profile Tab
// ---------------------------------------------------------------------------

function ProfileTab({
  product,
  isAdmin,
  onSaved,
}: {
  product: Product
  isAdmin: boolean
  onSaved: (updated: Product) => void
}) {
  return (
    <div className="space-y-1">
      <InlineField label="Tasting Headline" value={product.tasting_headline} field="tasting_headline" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />
      <InlineField label="Short Description" value={product.short_description} field="short_description" productId={product.product_id} isAdmin={isAdmin} type="textarea" onSaved={onSaved} />
      <InlineField label="Long Description" value={product.long_description} field="long_description" productId={product.product_id} isAdmin={isAdmin} type="textarea" onSaved={onSaved} />

      <div className="border-t border-slate-100 my-2" />

      <div className="grid grid-cols-2 gap-x-4">
        <InlineField label="Harvest" value={product.harvest_season} field="harvest_season" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />
        <InlineField label="Cultivar" value={product.cultivar} field="cultivar" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />
        <InlineField label="Region" value={product.production_region} field="production_region" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />
        <InlineField label="Grind" value={product.grind_method} field="grind_method" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />
        <InlineField label="Roast" value={product.roast_level} field="roast_level" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />
        <InlineField label="Texture" value={product.texture_description} field="texture_description" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />
      </div>
      <InlineField label="Best For" value={product.best_for} field="best_for" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />

      {product.photo_folder_url && (
        <a
          href={product.photo_folder_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 mt-2"
        >
          <Camera className="h-3 w-3" /> View Photos
        </a>
      )}

      {/* Competitor-specific fields */}
      {product.is_competitor && (
        <>
          <div className="border-t border-slate-100 my-2" />
          <InlineField label="Producer" value={product.competitor_producer} field="competitor_producer" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />
          <InlineField label="Producer URL" value={product.competitor_url} field="competitor_url" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />
          <InlineField label="Introduced By" value={product.introduced_by} field="introduced_by" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />
          {isAdmin && (
            <ContactCheckbox product={product} onSaved={onSaved} />
          )}
        </>
      )}
    </div>
  )
}

function ContactCheckbox({
  product,
  onSaved,
}: {
  product: Product
  onSaved: (updated: Product) => void
}) {
  const [checked, setChecked] = useState(product.should_contact_producer)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from prop
  useEffect(() => setChecked(product.should_contact_producer), [product.should_contact_producer])

  async function toggle(val: boolean) {
    setChecked(val)
    const res = await fetch(`/api/products/${encodeURIComponent(product.product_id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ should_contact_producer: val }),
    })
    if (res.ok) onSaved(await res.json())
  }

  return (
    <label className="flex items-center gap-2 py-1 text-xs text-slate-600 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => toggle(e.target.checked)}
        className="rounded border-slate-300"
      />
      Should contact producer
    </label>
  )
}

// ---------------------------------------------------------------------------
// Pricing Tab
// ---------------------------------------------------------------------------

function PricingTab({
  product,
  isAdmin,
  marginThresholds,
  onSaved,
}: {
  product: Product
  isAdmin: boolean
  marginThresholds: MarginThresholds
  onSaved: (updated: Product) => void
}) {
  const [tiers, setTiers] = useState<PricingTier[]>([])
  const [tiersLoading, setTiersLoading] = useState(true)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch pattern
    setTiersLoading(true)
    fetch(`/api/products/${encodeURIComponent(product.product_id)}/tiers`)
      .then((r) => r.json())
      .then((d) => { setTiers(d); setTiersLoading(false) })
      .catch(() => setTiersLoading(false))
  }, [product.product_id])

  const health = getMarginHealth(product.gross_profit_margin, product.gross_profit_per_kg_usd, marginThresholds)
  const healthColors = { green: 'text-green-600', yellow: 'text-yellow-600', red: 'text-red-600' }
  const healthLabels = { green: 'Healthy', yellow: 'Watch', red: 'Low' }
  const fmtUsd = (v: number | null) => v != null ? formatCurrency(v, 'USD') : '—'
  const fmtGbp = (v: number | null) => v != null ? formatCurrency(v, 'GBP') : '—'
  const fmtEur = (v: number | null) => v != null ? formatCurrency(v, 'EUR') : '—'
  const fmtJpy = (v: number | null) => v != null ? `¥${v.toLocaleString()}` : '—'
  const fmtPct = (v: number | null) => v != null ? `${(v * 100).toFixed(1)}%` : '—'
  const fmtStock = (v: number | null) => v != null && v > 0 ? `~${v}kg/month` : '—'

  return (
    <div className="space-y-4">
      {/* Cost & Pricing */}
      <div>
        <h3 className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Cost & Pricing</h3>
        <div className="space-y-0.5">
          <InlineNumericField label="Matcha Cost (¥/kg)" value={product.matcha_cost_per_kg_jpy} field="matcha_cost_per_kg_jpy" productId={product.product_id} isAdmin={isAdmin} format={fmtJpy} onSaved={onSaved} />
          <InlineNumericField label="US Landing Cost" value={product.us_landing_cost_per_kg_usd} field="us_landing_cost_per_kg_usd" productId={product.product_id} isAdmin={isAdmin} format={fmtUsd} onSaved={onSaved} />
          <InlineNumericField label="UK Landing Cost" value={product.uk_landing_cost_per_kg_gbp} field="uk_landing_cost_per_kg_gbp" productId={product.product_id} isAdmin={isAdmin} format={fmtGbp} onSaved={onSaved} />
          <InlineNumericField label="EU Landing Cost" value={product.eu_landing_cost_per_kg_eur} field="eu_landing_cost_per_kg_eur" productId={product.product_id} isAdmin={isAdmin} format={fmtEur} onSaved={onSaved} />
        </div>
      </div>

      {/* Selling Prices */}
      <div>
        <h3 className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Selling Prices</h3>
        <div className="space-y-0.5">
          <InlineNumericField label="USD" value={product.selling_price_usd} field="selling_price_usd" productId={product.product_id} isAdmin={isAdmin} format={(v) => `${fmtUsd(v)} (min: ${fmtUsd(product.min_price_usd)})`} onSaved={onSaved} />
          <InlineNumericField label="GBP" value={product.selling_price_gbp} field="selling_price_gbp" productId={product.product_id} isAdmin={isAdmin} format={(v) => `${fmtGbp(v)} (min: ${fmtGbp(product.min_price_gbp)})`} onSaved={onSaved} />
          <InlineNumericField label="EUR" value={product.selling_price_eur} field="selling_price_eur" productId={product.product_id} isAdmin={isAdmin} format={(v) => `${fmtEur(v)} (min: ${fmtEur(product.min_price_eur)})`} onSaved={onSaved} />
        </div>
      </div>

      {/* Margin */}
      <div>
        <h3 className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Margin</h3>
        <div className="flex items-center gap-2 text-sm">
          <span className={`font-medium ${healthColors[health]}`}>
            {fmtPct(product.gross_profit_margin)}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            health === 'green' ? 'bg-green-100 text-green-700' :
            health === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>
            {healthLabels[health]}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Gross Profit: {fmtUsd(product.gross_profit_per_kg_usd)}/kg
        </p>
        <p className="text-xs text-slate-500">
          Stock: {fmtStock(product.monthly_available_stock_kg)}
        </p>
      </div>

      {/* Volume Tiers */}
      <div>
        <h3 className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Volume Pricing Tiers</h3>
        {tiersLoading ? (
          <p className="text-xs text-slate-400">Loading...</p>
        ) : tiers.length === 0 ? (
          <p className="text-xs text-slate-400">No tiers configured.</p>
        ) : (
          <div className="space-y-1">
            {tiers.map((t) => (
              <div key={t.tier_id} className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{t.tier_name}</span>
                <span className="text-slate-500 tabular-nums">
                  {t.min_volume_kg}kg+ · {formatCurrency(t.price_per_kg, t.currency || 'USD')}/kg
                  {t.discount_pct > 0 && (
                    <span className="text-slate-400 ml-1">(-{t.discount_pct}%)</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create Form (for both Hisa and Competitor products)
// ---------------------------------------------------------------------------

function CreateForm({
  isCompetitor,
  onClose,
  onCreated,
}: {
  isCompetitor: boolean
  onClose: () => void
  onCreated: (product: Product) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<{ supplier_id: string; supplier_name: string; supplier_name_en: string | null }[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [productId, setProductId] = useState(isCompetitor ? 'COMP-' : '')
  const [name, setName] = useState('')
  const [producer, setProducer] = useState('')
  const [producerUrl, setProducerUrl] = useState('')
  const [introducedBy, setIntroducedBy] = useState('')
  const [region, setRegion] = useState('')
  const [cultivar, setCultivar] = useState('')
  const [harvestSeason, setHarvestSeason] = useState('')
  const [headline, setHeadline] = useState('')
  const [shortDesc, setShortDesc] = useState('')
  const [longDesc, setLongDesc] = useState('')
  const [roastLevel, setRoastLevel] = useState('')
  const [texture, setTexture] = useState('')
  const [bestFor, setBestFor] = useState('')

  useEffect(() => {
    if (isCompetitor) return
    fetch('/api/suppliers')
      .then((r) => r.json())
      .then((d) => {
        const sorted = (d.suppliers ?? []).sort((a: { supplier_name_en: string | null; supplier_name: string }, b: { supplier_name_en: string | null; supplier_name: string }) =>
          (a.supplier_name_en || a.supplier_name).localeCompare(b.supplier_name_en || b.supplier_name),
        )
        setSuppliers(sorted)
      })
      .catch(() => {})
  }, [isCompetitor])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId.trim() || !name.trim() || (!isCompetitor && !selectedSupplierId)) return
    setSaving(true)
    setError(null)

    const body: Record<string, unknown> = {
      product_id: productId.trim(),
      customer_facing_product_name: name.trim(),
      supplier_product_name: productId.trim(),
      price_per_kg: 0,
      is_competitor: isCompetitor,
      active: !isCompetitor,
      production_region: region.trim() || null,
      cultivar: cultivar.trim() || null,
      harvest_season: harvestSeason.trim() || null,
      tasting_headline: headline.trim() || null,
      short_description: shortDesc.trim() || null,
      long_description: longDesc.trim() || null,
      roast_level: roastLevel || null,
      texture_description: texture.trim() || null,
      best_for: bestFor.trim() || null,
    }
    if (isCompetitor) {
      body.competitor_producer = producer.trim() || null
      body.competitor_url = producerUrl.trim() || null
      body.introduced_by = introducedBy.trim() || null
    }
    if (selectedSupplierId) {
      const selected = suppliers.find((s) => s.supplier_id === selectedSupplierId)
      body.primary_supplier_id = selectedSupplierId
      body.supplier = selected?.supplier_name_en || selected?.supplier_name || null
    }

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const created = await res.json()
        if (selectedSupplierId) {
          await fetch(`/api/suppliers/${selectedSupplierId}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: created.product_id, is_primary: true }),
          }).catch(() => {})
        }
        onCreated(created)
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.error || `Failed to create product (${res.status})`)
      }
    } catch {
      setError('Network error — please try again')
    }
    setSaving(false)
  }

  const inputClass = 'w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent'

  return (
    <div className="w-[440px] shrink-0 border-l border-slate-200 flex flex-col overflow-hidden bg-white">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-slate-900">
          {isCompetitor ? 'Add Competitor Evaluation' : 'Add Product'}
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !productId.trim() || !name.trim() || (!isCompetitor && !selectedSupplierId)}
            className="px-4 py-1.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Creating...' : 'Create'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
        </div>
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide">Product ID *</label>
          <input value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass} required />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide">Product Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
        </div>

        {!isCompetitor && (
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Supplier *</label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className={inputClass}
            >
              <option value="">— None —</option>
              {suppliers.map((s) => (
                <option key={s.supplier_id} value={s.supplier_id}>
                  {s.supplier_name_en || s.supplier_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {isCompetitor && (
          <>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Producer</label>
              <input value={producer} onChange={(e) => setProducer(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Producer URL</label>
              <input value={producerUrl} onChange={(e) => setProducerUrl(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Introduced By</label>
              <input value={introducedBy} onChange={(e) => setIntroducedBy(e.target.value)} className={inputClass} />
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Region</label>
            <input value={region} onChange={(e) => setRegion(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Cultivar</label>
            <input value={cultivar} onChange={(e) => setCultivar(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Harvest Season</label>
            <input value={harvestSeason} onChange={(e) => setHarvestSeason(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Roast Level</label>
            <select value={roastLevel} onChange={(e) => setRoastLevel(e.target.value)} className={inputClass}>
              <option value="">—</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide">Texture</label>
          <input value={texture} onChange={(e) => setTexture(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide">Best For</label>
          <input value={bestFor} onChange={(e) => setBestFor(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide">Tasting Headline</label>
          <input value={headline} onChange={(e) => setHeadline(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide">Short Description</label>
          <textarea value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} className={`${inputClass} resize-none`} rows={2} />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide">Long Description</label>
          <textarea value={longDesc} onChange={(e) => setLongDesc(e.target.value)} className={`${inputClass} resize-none`} rows={3} />
        </div>

      </form>
    </div>
  )
}
