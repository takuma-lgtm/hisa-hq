'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { getMarginHealth, type MarginThresholds } from '@/lib/margin-health'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import TastingLogTab from './TastingLogTab'
import type { Product, PricingTier } from '@/types/database'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  product: Product
  isAdmin: boolean
  marginThresholds: MarginThresholds
  onClose: () => void
  onSaved: (product: Product) => void
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ProductAccordionPanel({
  product,
  isAdmin,
  marginThresholds,
  onClose,
  onSaved,
}: Props) {
  const [localProduct, setLocalProduct] = useState<Product>(product)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalProduct(product)
  }, [product.product_id])

  function handleFieldSaved(updated: Product) {
    setLocalProduct(updated)
    onSaved(updated)
  }

  return (
    <div className="flex flex-col max-h-[90vh]">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 leading-tight">
              {localProduct.customer_facing_product_name}
            </h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{localProduct.product_id}</p>
            {localProduct.tasting_headline && (
              <p className="text-sm italic text-gray-500 mt-1">{localProduct.tasting_headline}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Accordion body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <Accordion type="single" defaultValue="profile" collapsible className="w-full space-y-2">

          {/* ── Profile ── */}
          <AccordionItem
            value="profile"
            className="border rounded-xl last:border-b"
          >
            <AccordionTrigger
              className={cn(
                'text-left m-1 rounded-lg data-[state=open]:rounded-b-none',
                'bg-muted/50 hover:bg-muted/80 hover:no-underline',
                'data-[state=open]:[&_svg.chevron]:rotate-180',
                '[&>svg]:hidden', // hide default chevron
                'px-5 py-3 transition-colors duration-200 cursor-pointer'
              )}
            >
              <div className="flex flex-1 items-center justify-between gap-4">
                <h3 className="text-xl font-semibold text-gray-900">Profile</h3>
                <AccordionIcon />
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 pt-2">
              <ProfileSection
                product={localProduct}
                isAdmin={isAdmin}
                onSaved={handleFieldSaved}
              />
            </AccordionContent>
          </AccordionItem>

          {/* ── Pricing ── */}
          {!localProduct.is_competitor && (
            <AccordionItem
              value="pricing"
              className="border rounded-xl last:border-b"
            >
              <AccordionTrigger
                className={cn(
                  'text-left m-1 rounded-lg data-[state=open]:rounded-b-none',
                  'bg-muted/50 hover:bg-muted/80 hover:no-underline',
                  '[&>svg]:hidden',
                  'px-5 py-3 transition-colors duration-200 cursor-pointer'
                )}
              >
                <div className="flex flex-1 items-center justify-between gap-4">
                  <h3 className="text-xl font-semibold text-gray-900">Pricing</h3>
                  <AccordionIcon />
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5 pt-2">
                <PricingSection
                  product={localProduct}
                  isAdmin={isAdmin}
                  marginThresholds={marginThresholds}
                  onSaved={handleFieldSaved}
                />
              </AccordionContent>
            </AccordionItem>
          )}

          {/* ── Tasting Log ── */}
          <AccordionItem
            value="tasting"
            className="border rounded-xl last:border-b"
          >
            <AccordionTrigger
              className={cn(
                'text-left m-1 rounded-lg data-[state=open]:rounded-b-none',
                'bg-muted/50 hover:bg-muted/80 hover:no-underline',
                '[&>svg]:hidden',
                'px-5 py-3 transition-colors duration-200 cursor-pointer'
              )}
            >
              <div className="flex flex-1 items-center justify-between gap-4">
                <h3 className="text-xl font-semibold text-gray-900">Tasting Log</h3>
                <AccordionIcon />
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 pt-2">
              <TastingLogTab productId={localProduct.product_id} isAdmin={isAdmin} />
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Accordion icon: X when open, Plus when closed
// ---------------------------------------------------------------------------

function AccordionIcon() {
  return (
    <div className="relative h-6 w-6 shrink-0">
      {/* Plus — visible when closed */}
      <Plus
        className="absolute inset-0 h-6 w-6 transition-all duration-300
          group-data-[state=open]:opacity-0 group-data-[state=closed]:opacity-100
          [[data-state=open]_&]:opacity-0 [[data-state=closed]_&]:opacity-100"
        strokeWidth={2}
      />
      {/* X — visible when open */}
      <X
        className="absolute inset-0 h-6 w-6 transition-all duration-300
          [[data-state=open]_&]:opacity-100 [[data-state=closed]_&]:opacity-0"
        strokeWidth={2}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Profile Section
// ---------------------------------------------------------------------------

function ProfileSection({
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

      <div className="border-t border-slate-100 my-3" />

      <div className="grid grid-cols-2 gap-x-4">
        <InlineField label="Harvest" value={product.harvest_season} field="harvest_season" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />
        <InlineField label="Cultivar" value={product.cultivar} field="cultivar" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />
        <InlineField label="Region" value={product.production_region} field="production_region" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />
        <InlineField label="Grind" value={product.grind_method} field="grind_method" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />
        <InlineField label="Roast" value={product.roast_level} field="roast_level" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />
        <InlineField label="Texture" value={product.texture_description} field="texture_description" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />
      </div>
      <InlineField label="Best For" value={product.best_for} field="best_for" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />

      <div className="border-t border-slate-100 my-3" />

      <InlineField label="Internal Name (JPN)" value={product.name_internal_jpn} field="name_internal_jpn" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />
      {!product.is_competitor && (
        <TierSelect product={product} isAdmin={isAdmin} onSaved={onSaved} />
      )}
      {!product.is_competitor && (
        <ActiveToggle product={product} isAdmin={isAdmin} onSaved={onSaved} />
      )}

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

      {product.is_competitor && (
        <>
          <div className="border-t border-slate-100 my-3" />
          <InlineField label="Producer" value={product.competitor_producer} field="competitor_producer" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />
          <InlineField label="Producer URL" value={product.competitor_url} field="competitor_url" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />
          <InlineField label="Introduced By" value={product.introduced_by} field="introduced_by" productId={product.product_id} isAdmin={isAdmin} onSaved={onSaved} />
          {isAdmin && <ContactCheckbox product={product} onSaved={onSaved} />}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pricing Section
// ---------------------------------------------------------------------------

function PricingSection({
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  return (
    <div className="space-y-4">
      {/* Cost */}
      <div>
        <h4 className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Cost & Landing</h4>
        <div className="space-y-0.5">
          <InlineNumericField label="Matcha Cost (¥/kg)" value={product.matcha_cost_per_kg_jpy} field="matcha_cost_per_kg_jpy" productId={product.product_id} isAdmin={isAdmin} format={fmtJpy} onSaved={onSaved} />
          <InlineNumericField label="US Landing Cost" value={product.us_landing_cost_per_kg_usd} field="us_landing_cost_per_kg_usd" productId={product.product_id} isAdmin={isAdmin} format={fmtUsd} onSaved={onSaved} />
          <InlineNumericField label="UK Landing Cost" value={product.uk_landing_cost_per_kg_gbp} field="uk_landing_cost_per_kg_gbp" productId={product.product_id} isAdmin={isAdmin} format={fmtGbp} onSaved={onSaved} />
          <InlineNumericField label="EU Landing Cost" value={product.eu_landing_cost_per_kg_eur} field="eu_landing_cost_per_kg_eur" productId={product.product_id} isAdmin={isAdmin} format={fmtEur} onSaved={onSaved} />
        </div>
      </div>

      {/* Selling Prices */}
      <div>
        <h4 className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Selling Prices</h4>
        <div className="space-y-0.5">
          <InlineNumericField label="USD price" value={product.selling_price_usd} field="selling_price_usd" productId={product.product_id} isAdmin={isAdmin} format={fmtUsd} onSaved={onSaved} />
          <InlineNumericField label="USD min" value={product.min_price_usd} field="min_price_usd" productId={product.product_id} isAdmin={isAdmin} format={fmtUsd} onSaved={onSaved} />
          <InlineNumericField label="GBP price" value={product.selling_price_gbp} field="selling_price_gbp" productId={product.product_id} isAdmin={isAdmin} format={fmtGbp} onSaved={onSaved} />
          <InlineNumericField label="GBP min" value={product.min_price_gbp} field="min_price_gbp" productId={product.product_id} isAdmin={isAdmin} format={fmtGbp} onSaved={onSaved} />
          <InlineNumericField label="EUR price" value={product.selling_price_eur} field="selling_price_eur" productId={product.product_id} isAdmin={isAdmin} format={fmtEur} onSaved={onSaved} />
          <InlineNumericField label="EUR min" value={product.min_price_eur} field="min_price_eur" productId={product.product_id} isAdmin={isAdmin} format={fmtEur} onSaved={onSaved} />
        </div>
      </div>

      {/* Margin */}
      <div>
        <h4 className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Margin</h4>
        <div className="flex items-center gap-2 text-sm">
          <span className={`font-medium ${healthColors[health]}`}>{fmtPct(product.gross_profit_margin)}</span>
          <span className={cn('text-xs px-1.5 py-0.5 rounded',
            health === 'green' ? 'bg-green-100 text-green-700' :
            health === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          )}>
            {healthLabels[health]}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">Gross Profit: {fmtUsd(product.gross_profit_per_kg_usd)}/kg</p>
        <InlineNumericField label="Stock/mo (kg)" value={product.monthly_available_stock_kg} field="monthly_available_stock_kg" productId={product.product_id} isAdmin={isAdmin} format={(v) => v != null && v > 0 ? `~${v}kg/month` : '—'} onSaved={onSaved} />
      </div>

      {/* Volume Tiers */}
      <div>
        <h4 className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Volume Pricing Tiers</h4>
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
                  {t.discount_pct > 0 && <span className="text-slate-400 ml-1">(-{t.discount_pct}%)</span>}
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
// Inline Editable Field (text / textarea)
// ---------------------------------------------------------------------------

function InlineField({
  label,
  value,
  field,
  productId,
  isAdmin,
  type = 'text',
  onSaved,
  valueClassName,
}: {
  label: string
  value: string | null
  field: string
  productId: string
  isAdmin: boolean
  type?: 'text' | 'textarea'
  onSaved: (updated: Product) => void
  valueClassName?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value ?? '')
    setEditing(false)
  }, [value])

  async function save() {
    if (draft === (value ?? '')) { setEditing(false); return }
    setSaving(true)
    const res = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: draft.trim() || null }),
    })
    if (res.ok) onSaved(await res.json())
    setSaving(false)
    setEditing(false)
  }

  if (!isAdmin) {
    return (
      <div className="py-1">
        {label && <span className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</span>}
        {type === 'textarea'
          ? <p className={valueClassName ?? 'text-sm text-slate-700 whitespace-pre-wrap'}>{value || '—'}</p>
          : <p className={valueClassName ?? 'text-sm text-slate-700'}>{value || '—'}</p>
        }
      </div>
    )
  }

  if (!editing) {
    return (
      <div className="py-1 cursor-pointer group" onClick={() => setEditing(true)}>
        {label && <span className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</span>}
        {type === 'textarea'
          ? <p className={`${valueClassName ?? 'text-sm text-slate-700'} whitespace-pre-wrap group-hover:bg-green-50/50 rounded px-1 -mx-1 transition-colors`}>
              {value || <span className="text-slate-300 italic">Click to add...</span>}
            </p>
          : <p className={`${valueClassName ?? 'text-sm text-slate-700'} group-hover:bg-green-50/50 rounded px-1 -mx-1 transition-colors`}>
              {value || <span className="text-slate-300 italic">Click to add...</span>}
            </p>
        }
      </div>
    )
  }

  const inputClass = 'w-full text-sm border border-slate-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-slate-400'

  return (
    <div className="py-1">
      <span className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</span>
      {type === 'textarea'
        ? <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={save}
            onKeyDown={(e) => { if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) } }}
            className={`${inputClass} resize-none`} rows={3} disabled={saving} />
        : <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={save}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) } }}
            className={inputClass} disabled={saving} />
      }
      {saving && <span className="text-[10px] text-green-600">Saving...</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline Numeric Field
// ---------------------------------------------------------------------------

function InlineNumericField({
  label, value, field, productId, isAdmin, format, onSaved,
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      <input autoFocus type="number" step="any" value={draft}
        onChange={(e) => setDraft(e.target.value)} onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setDraft(value != null ? String(value) : ''); setEditing(false) } }}
        className="w-28 text-sm text-right border border-slate-300 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-slate-400"
        disabled={saving}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tier Select
// ---------------------------------------------------------------------------

const TIER_OPTIONS: { value: 'premium' | 'versatile' | 'budget' | ''; label: string }[] = [
  { value: '', label: 'Unassigned' },
  { value: 'premium', label: 'Premium Edge' },
  { value: 'versatile', label: 'All-Purpose Matcha' },
  { value: 'budget', label: 'Budget-Friendly' },
]

function TierSelect({ product, isAdmin, onSaved }: { product: Product; isAdmin: boolean; onSaved: (p: Product) => void }) {
  const [saving, setSaving] = useState(false)
  const current = product.display_tier ?? ''

  async function handleChange(val: string) {
    setSaving(true)
    const res = await fetch(`/api/products/${encodeURIComponent(product.product_id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_tier: val || null }),
    })
    if (res.ok) onSaved(await res.json())
    setSaving(false)
  }

  if (!isAdmin) {
    const label = TIER_OPTIONS.find((o) => o.value === current)?.label ?? 'Unassigned'
    return (
      <div className="flex items-center justify-between py-1">
        <span className="text-[10px] text-slate-400 uppercase tracking-wide">Lane</span>
        <span className="text-sm text-slate-700">{label}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[10px] text-slate-400 uppercase tracking-wide">Lane</span>
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className="text-sm border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-slate-400 bg-white text-slate-700 disabled:opacity-50"
      >
        {TIER_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Active Toggle
// ---------------------------------------------------------------------------

function ActiveToggle({ product, isAdmin, onSaved }: { product: Product; isAdmin: boolean; onSaved: (p: Product) => void }) {
  const [active, setActive] = useState(product.active)
  useEffect(() => { setActive(product.active) }, [product.active]) // eslint-disable-line react-hooks/set-state-in-effect

  async function toggle(val: boolean) {
    setActive(val)
    const res = await fetch(`/api/products/${encodeURIComponent(product.product_id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: val }),
    })
    if (res.ok) onSaved(await res.json())
  }

  if (!isAdmin) {
    return (
      <div className="py-1">
        <span className="text-[10px] text-slate-400 uppercase tracking-wide">Status</span>
        <p className="text-sm text-slate-700">{active ? 'Active' : 'Inactive'}</p>
      </div>
    )
  }
  return (
    <label className="flex items-center gap-2 py-1 text-xs text-slate-600 cursor-pointer">
      <input type="checkbox" checked={active} onChange={(e) => toggle(e.target.checked)} className="rounded border-slate-300" />
      Active
    </label>
  )
}

// ---------------------------------------------------------------------------
// Contact Checkbox (competitor products)
// ---------------------------------------------------------------------------

function ContactCheckbox({ product, onSaved }: { product: Product; onSaved: (p: Product) => void }) {
  const [checked, setChecked] = useState(product.should_contact_producer)
  useEffect(() => { setChecked(product.should_contact_producer) }, [product.should_contact_producer]) // eslint-disable-line react-hooks/set-state-in-effect

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
      <input type="checkbox" checked={checked} onChange={(e) => toggle(e.target.checked)} className="rounded border-slate-300" />
      Should contact producer
    </label>
  )
}
