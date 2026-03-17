'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ExternalLink, Phone, Mail, Copy, Check, Printer, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { OpportunityStage, UserRole, Product, PricingTier, CrmSetting } from '@/types/database'
import { OPPORTUNITY_STAGE_LABELS, OPPORTUNITY_STAGE_COLORS, CALL_TYPE_LABELS, CALL_OUTCOME_LABELS } from '@/lib/constants'
import {
  calculateQuoteLine,
  findApplicableTier,
  generateQuoteMessage,
  getSellingPriceForCurrency,
  parseMarginThresholds,
  type QuoteCurrency,
  type QuoteLineResult,
} from '@/lib/quote-pricing'
import PaymentSection from './PaymentSection'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OpportunityRow {
  opportunity_id: string
  customer_id: string
  stage: OpportunityStage
  assigned_to: string | null
  notes: string | null
  created_at: string
  updated_at: string
  customer: {
    customer_id: string
    cafe_name: string | null
    city: string | null
    country: string | null
    state: string | null
    contact_person: string | null
    phone: string | null
    email: string | null
    instagram_url: string | null
    instagram_handle: string | null
    address: string | null
    zip_code: string | null
    qualified_products: string | null
    qualified_volume_kg: number | null
    qualified_budget: string | null
  }
  assigned_profile: { id: string; name: string; role: string } | null
}

interface SampleBatchItem {
  item_id: string
  batch_id: string
  product_id: string | null
  product_snapshot: string | null
  qty_grams: number | null
  feedback: string
  notes: string | null
  sku?: { sku_name: string; name_external_eng: string | null } | null
}

interface SampleBatch {
  batch_id: string
  opportunity_id: string
  customer_id: string
  carrier: string | null
  tracking_number: string | null
  ship_from: string | null
  shipped_at: string | null
  date_shipped: string | null
  delivery_status: string | null
  delivered_at: string | null
  created_at: string
  items: SampleBatchItem[]
  tracking_url: string | null
  carrier_status: string | null
  carrier_status_detail: string | null
  estimated_delivery: string | null
  last_tracked_at: string | null
  auto_track_enabled: boolean
}

interface DraftMessage {
  draft_id: string
  customer_id: string
  opportunity_id: string | null
  batch_id: string | null
  trigger_event: string
  channel: string
  message_text: string
  status: 'pending' | 'sent' | 'dismissed'
  created_at: string
  sent_at: string | null
  dismissed_at: string | null
}

interface Proposal {
  proposal_id: string
  opportunity_id: string
  sent_via: string
  notes: string | null
  default_currency: string
  created_at: string
  items: {
    item_id: string
    product_id: string
    price_per_kg: number
    currency: string
    notes: string | null
    product: { customer_facing_product_name: string | null; supplier_product_name: string | null }
  }[]
}

interface CallLog {
  log_id: string
  call_type: string
  outcome: string
  duration_minutes: number | null
  raw_summary: string | null
  called_at: string
  logged_by_profile: { name: string }
}

interface InventoryLevel {
  sku_id: string
  warehouse_id: string
  quantity: number
  sku: { sku_name: string; name_external_eng: string | null; product_id: string | null; sku_type: string; unit_weight_kg: number }
  warehouse: { name: string; short_code: string; warehouse_id: string }
}

interface Props {
  opportunity: OpportunityRow
  userRole: UserRole
  canEdit: boolean
  products: Product[]
  onClose: () => void
  onStageChanged: (oppId: string, newStage: OpportunityStage) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLocation(city?: string | null, state?: string | null, country?: string | null): string {
  const parts = [city, state, country].filter(Boolean)
  return parts.join(', ') || '—'
}

function MarginDot({ health }: { health: 'green' | 'yellow' | 'red' }) {
  const colors = { green: 'bg-green-500', yellow: 'bg-amber-500', red: 'bg-red-500' }
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[health]}`} title={`Margin: ${health}`} />
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OpportunitySidePanel({ opportunity: opp, userRole, canEdit, products, onClose, onStageChanged }: Props) {
  const [batches, setBatches] = useState<SampleBatch[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [inventoryLevels, setInventoryLevels] = useState<InventoryLevel[]>([])
  const [settings, setSettings] = useState<CrmSetting[]>([])
  const [allTiers, setAllTiers] = useState<PricingTier[]>([])
  const [drafts, setDrafts] = useState<DraftMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stageUpdating, setStageUpdating] = useState(false)

  const effectiveStage = opp.stage
  const oppId = opp.opportunity_id

  // Fetch panel data
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      fetch(`/api/opportunities/${oppId}/samples`).then((r) => r.json()),
      fetch(`/api/opportunities/${oppId}/proposals`).then((r) => r.json()),
      fetch(`/api/opportunities/${oppId}/calls`).then((r) => r.json()),
      fetch('/api/inventory/levels?sku_type=Sample').then((r) => r.json()),
      fetch('/api/settings').then((r) => r.json()),
      fetch(`/api/opportunities/${oppId}/drafts`).then((r) => r.json()),
    ])
      .then(([samplesRes, proposalsRes, callsRes, levelsRes, settingsRes, draftsRes]) => {
        if (cancelled) return
        setBatches(samplesRes.batches ?? [])
        setProposals(proposalsRes.proposals ?? [])
        setCallLogs(callsRes.callLogs ?? [])
        setInventoryLevels(levelsRes.data ?? [])
        setSettings(settingsRes.data ?? settingsRes ?? [])
        setDrafts((draftsRes.drafts ?? []).filter((d: DraftMessage) => d.status === 'pending'))
        setLoading(false)
      })
      .catch((err) => {
        if (!cancelled) { setError(err.message); setLoading(false) }
      })

    return () => { cancelled = true }
  }, [oppId])

  // Fetch pricing tiers for all active products
  useEffect(() => {
    if (products.length === 0) return
    Promise.all(
      products.map((p) =>
        fetch(`/api/products/${p.product_id}/tiers`).then((r) => r.json()).then((d) => d.tiers ?? d ?? [])
      ),
    ).then((results) => {
      setAllTiers(results.flat())
    }).catch(() => {})
  }, [products])

  async function advanceStage(newStage: OpportunityStage, extra?: Record<string, unknown>) {
    setStageUpdating(true)
    try {
      const res = await fetch(`/api/opportunities/${oppId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage, ...extra }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      onStageChanged(oppId, newStage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update stage')
    } finally {
      setStageUpdating(false)
    }
  }

  const stageColor = OPPORTUNITY_STAGE_COLORS[effectiveStage] ?? 'bg-slate-100 text-slate-600'

  return (
    <div className="w-[440px] shrink-0 border-l border-slate-200 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 shrink-0">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-900 truncate">{opp.customer.cafe_name ?? '—'}</h2>
            <p className="text-xs text-slate-500 truncate">
              {formatLocation(opp.customer.city, opp.customer.state, opp.customer.country)}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded ml-2 shrink-0">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${stageColor}`}>
            {OPPORTUNITY_STAGE_LABELS[effectiveStage] ?? effectiveStage}
          </span>
          {opp.assigned_profile && (
            <span className="text-xs text-slate-400">Assigned: {opp.assigned_profile.name}</span>
          )}
        </div>
        {/* Contact links */}
        <div className="flex items-center gap-3 mt-2">
          {opp.customer.instagram_url && (
            <a href={opp.customer.instagram_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
              <ExternalLink className="w-3 h-3" /> IG
            </a>
          )}
          {opp.customer.phone && (
            <a href={`tel:${opp.customer.phone}`} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
              <Phone className="w-3 h-3" /> Phone
            </a>
          )}
          {opp.customer.email && (
            <a href={`mailto:${opp.customer.email}`} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
              <Mail className="w-3 h-3" /> Email
            </a>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {loading ? (
          <div className="text-center text-slate-400 text-sm py-8">Loading...</div>
        ) : error ? (
          <div className="text-center text-red-500 text-sm py-4">{error}</div>
        ) : (
          <>
            {/* Qualification summary */}
            <QualificationCard customer={opp.customer} />

            {/* Stage action area */}
            {effectiveStage === 'sample_approved' && (
              <SampleBatchSection
                oppId={oppId}
                customerId={opp.customer.customer_id}
                customerAddress={opp.customer.address}
                customerCountry={opp.customer.country}
                batches={batches}
                inventoryLevels={inventoryLevels}
                canEdit={canEdit}
                onBatchCreated={(batch) => {
                  setBatches((prev) => [batch, ...prev])
                  onStageChanged(oppId, 'samples_shipped')
                }}
              />
            )}

            {effectiveStage === 'samples_shipped' && (
              <ShippedSection
                oppId={oppId}
                batches={batches}
                canEdit={canEdit}
                stageUpdating={stageUpdating}
                onMarkDelivered={() => advanceStage('samples_delivered')}
                onTrackingUpdated={(batchId, tn) => {
                  setBatches((prev) => prev.map((b) => b.batch_id === batchId ? { ...b, tracking_number: tn } : b))
                }}
                onBatchUpdated={(updated) => {
                  setBatches((prev) => prev.map((b) => b.batch_id === updated.batch_id ? { ...b, ...updated } : b))
                }}
              />
            )}

            {effectiveStage === 'samples_delivered' && (
              <DeliveredSection
                oppId={oppId}
                batches={batches}
                products={products}
                allTiers={allTiers}
                settings={settings}
                customerName={opp.customer.contact_person}
                canEdit={canEdit}
                stageUpdating={stageUpdating}
                onQuoteSaved={(p) => {
                  setProposals((prev) => [p, ...prev])
                }}
                onAdvance={() => advanceStage('quote_sent')}
                onFeedbackUpdated={(batchId, itemId, fb) => {
                  setBatches((prev) => prev.map((b) =>
                    b.batch_id === batchId
                      ? { ...b, items: b.items.map((i) => i.item_id === itemId ? { ...i, feedback: fb } : i) }
                      : b
                  ))
                }}
              />
            )}

            {effectiveStage === 'quote_sent' && (
              <QuoteSentSection
                proposals={proposals}
                products={products}
                allTiers={allTiers}
                settings={settings}
                customerName={opp.customer.contact_person}
                canEdit={canEdit}
                stageUpdating={stageUpdating}
                onMarkWon={() => advanceStage('deal_won')}
                onMarkLost={(reason) => advanceStage('lost', { disqualified_reason: reason })}
              />
            )}

            {(effectiveStage === 'quote_sent' || effectiveStage === 'deal_won' || effectiveStage === 'payment_received') && (
              <PaymentSection
                oppId={oppId}
                customer={opp.customer}
                proposals={proposals}
                settings={settings}
                canEdit={canEdit}
                onStageChanged={onStageChanged}
              />
            )}

            {effectiveStage === 'deal_won' && (
              <DealWonSection
                customer={opp.customer}
                oppId={oppId}
                canEdit={canEdit}
                hasProposals={proposals.length > 0}
                onConverted={() => onStageChanged(oppId, 'recurring_customer')}
              />
            )}

            {/* Pending draft messages */}
            {drafts.length > 0 && (
              <PendingDraftsSection
                drafts={drafts}
                customer={opp.customer}
                onDraftUpdated={(draftId, status) => {
                  setDrafts((prev) => prev.filter((d) => d.draft_id !== draftId))
                }}
              />
            )}

            {/* Call logging */}
            <CallLogSection
              oppId={oppId}
              customerId={opp.customer.customer_id}
              callLogs={callLogs}
              canEdit={canEdit}
              onCallLogged={(log) => setCallLogs((prev) => [log, ...prev])}
            />

            {/* Recent activity */}
            <RecentActivity batches={batches} proposals={proposals} callLogs={callLogs} oppId={oppId} />
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-200 shrink-0">
        <Link
          href={`/opportunities/${oppId}`}
          className="text-xs text-slate-700 hover:text-slate-800 font-medium"
        >
          Open Full Detail →
        </Link>
      </div>
    </div>
  )
}

// ===========================================================================
// Sub-components
// ===========================================================================

function QualificationCard({ customer }: { customer: OpportunityRow['customer'] }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Qualification</h3>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-slate-400">Products</span>
          <p className="text-slate-700 font-medium mt-0.5">{customer.qualified_products || '—'}</p>
        </div>
        <div>
          <span className="text-slate-400">Volume</span>
          <p className="text-slate-700 font-medium mt-0.5">{customer.qualified_volume_kg != null ? `${customer.qualified_volume_kg} kg/mo` : '—'}</p>
        </div>
        <div>
          <span className="text-slate-400">Budget</span>
          <p className="text-slate-700 font-medium mt-0.5">{customer.qualified_budget || '—'}</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sample Batch (sample_approved)
// ---------------------------------------------------------------------------

function SampleBatchSection({
  oppId, customerId, customerAddress, customerCountry, batches, inventoryLevels, canEdit, onBatchCreated,
}: {
  oppId: string
  customerId: string
  customerAddress: string | null
  customerCountry: string | null
  batches: SampleBatch[]
  inventoryLevels: InventoryLevel[]
  canEdit: boolean
  onBatchCreated: (batch: SampleBatch) => void
}) {
  const existingBatch = batches[0]
  if (existingBatch) {
    return <BatchSummary batch={existingBatch} oppId={oppId} />
  }
  if (!canEdit) return <p className="text-xs text-slate-400">Waiting for sample batch to be created.</p>

  return (
    <>
      {!customerAddress && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-xs text-amber-700">
          Shipping address incomplete —{' '}
          <Link href={`/leads/${customerId}`} className="underline hover:text-amber-900">update on the lead detail page</Link>
        </div>
      )}
      <SampleBatchForm oppId={oppId} customerId={customerId} customerCountry={customerCountry} inventoryLevels={inventoryLevels} onCreated={onBatchCreated} />
    </>
  )
}

function SampleBatchForm({
  oppId, customerId, customerCountry, inventoryLevels, onCreated,
}: {
  oppId: string
  customerId: string
  customerCountry: string | null
  inventoryLevels: InventoryLevel[]
  onCreated: (batch: SampleBatch) => void
}) {
  const isUS = customerCountry === 'United States' || customerCountry === 'US' || customerCountry === 'USA'

  // Group inventory by warehouse
  const warehouses = [...new Map(inventoryLevels.map((l) => [l.warehouse.warehouse_id, l.warehouse])).values()]
  const defaultWarehouse = warehouses.find((w) => isUS ? w.short_code === 'US' : w.short_code === 'JP') ?? warehouses[0]

  const [warehouseId, setWarehouseId] = useState(defaultWarehouse?.warehouse_id ?? '')
  const [items, setItems] = useState<{ sku_id: string; quantity: number }[]>([{ sku_id: '', quantity: 1 }])
  const [carrier, setCarrier] = useState('DHL')
  const [tracking, setTracking] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const availableSkus = inventoryLevels.filter((l) => l.warehouse.warehouse_id === warehouseId && l.quantity > 0)

  function addItem() { setItems((prev) => [...prev, { sku_id: '', quantity: 1 }]) }
  function removeItem(idx: number) { setItems((prev) => prev.filter((_, i) => i !== idx)) }
  function updateItem(idx: number, field: 'sku_id' | 'quantity', val: string | number) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it))
  }

  async function handleSubmit() {
    const validItems = items.filter((i) => i.sku_id && i.quantity > 0)
    if (validItems.length === 0) { setErr('Add at least one item'); return }
    setSubmitting(true)
    setErr(null)

    try {
      const warehouseName = warehouses.find((w) => w.warehouse_id === warehouseId)?.name ?? 'Warehouse'
      const res = await fetch(`/api/opportunities/${oppId}/samples`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          carrier,
          tracking_number: tracking || null,
          ship_from: warehouseName,
          ship_from_warehouse_id: warehouseId,
          shipped_at: new Date().toISOString(),
          notes: notes || null,
          items: validItems.map((i) => {
            const lvl = inventoryLevels.find((l) => l.sku_id === i.sku_id && l.warehouse.warehouse_id === warehouseId)
            return {
              sku_id: i.sku_id,
              product_id: lvl?.sku?.product_id ?? null,
              product_snapshot: lvl?.sku?.name_external_eng ?? lvl?.sku?.sku_name ?? null,
              qty_grams: i.quantity,
            }
          }),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()
      onCreated(data.batch)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create batch')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-3">
      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Create Sample Batch</h3>

      <div>
        <label className="text-xs text-slate-500 block mb-1">Ship From</label>
        <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5">
          {warehouses.map((w) => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-slate-500 block">SKU Items</label>
        {items.map((item, idx) => {
          const level = availableSkus.find((l) => l.sku_id === item.sku_id)
          return (
            <div key={idx} className="flex items-center gap-2">
              <select
                value={item.sku_id}
                onChange={(e) => updateItem(idx, 'sku_id', e.target.value)}
                className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5"
              >
                <option value="">Select SKU…</option>
                {availableSkus.map((l) => (
                  <option key={l.sku_id} value={l.sku_id}>
                    {l.sku.sku_name} — {l.sku.name_external_eng || l.sku.sku_name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                className="w-16 text-xs border border-slate-200 rounded px-2 py-1.5 text-center"
              />
              {level && <span className="text-[10px] text-slate-400 whitespace-nowrap">{level.quantity} avail</span>}
              {items.length > 1 && (
                <button onClick={() => removeItem(idx)} className="text-slate-400 hover:text-red-500 text-xs">×</button>
              )}
            </div>
          )
        })}
        <button onClick={addItem} className="text-xs text-slate-700 hover:underline">+ Add item</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Carrier</label>
          <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="w-full text-xs border border-slate-200 rounded px-2 py-1.5">
            {['DHL', 'FedEx', 'USPS', 'UPS', 'EMS', 'Other'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Tracking #</label>
          <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Optional" className="w-full text-xs border border-slate-200 rounded px-2 py-1.5" />
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-500 block mb-1">Notes</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full text-xs border border-slate-200 rounded px-2 py-1.5" />
      </div>

      {err && <p className="text-xs text-red-500">{err}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
      >
        {submitting ? 'Shipping…' : 'Ship Samples'}
      </button>
    </div>
  )
}

function BatchSummary({ batch, oppId }: { batch: SampleBatch; oppId: string }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-2">
      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sample Batch</h3>
      <div className="text-xs space-y-1">
        {batch.items.map((item) => (
          <div key={item.item_id} className="flex justify-between">
            <span className="text-slate-700">{item.product_snapshot ?? 'Item'}</span>
            <span className="text-slate-400">×{item.qty_grams ?? 1}</span>
          </div>
        ))}
      </div>
      <div className="text-xs text-slate-500 space-y-0.5">
        {batch.carrier && <p>Carrier: {batch.carrier}</p>}
        {batch.tracking_number && <p>Tracking: {batch.tracking_number}</p>}
        {batch.date_shipped && <p>Shipped: {new Date(batch.date_shipped).toLocaleDateString()}</p>}
      </div>
      <button
        onClick={() => window.open(`/api/opportunities/${oppId}/packing-slip?batch_id=${batch.batch_id}`, '_blank')}
        className="flex items-center gap-1 text-xs text-slate-700 hover:underline"
      >
        <Printer className="w-3 h-3" /> Print Packing Slip
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shipped (samples_shipped)
// ---------------------------------------------------------------------------

const CARRIER_STATUS_COLORS: Record<string, string> = {
  in_transit: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  exception: 'bg-red-100 text-red-700',
  unknown: 'bg-slate-100 text-slate-600',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function ShippedSection({
  oppId, batches, canEdit, stageUpdating, onMarkDelivered, onTrackingUpdated, onBatchUpdated,
}: {
  oppId: string
  batches: SampleBatch[]
  canEdit: boolean
  stageUpdating: boolean
  onMarkDelivered: () => void
  onTrackingUpdated: (batchId: string, tracking: string) => void
  onBatchUpdated: (batch: Partial<SampleBatch> & { batch_id: string }) => void
}) {
  const batch = batches[0]
  const [editTracking, setEditTracking] = useState(false)
  const [trackingVal, setTrackingVal] = useState(batch?.tracking_number ?? '')
  const [carrierVal, setCarrierVal] = useState(batch?.carrier ?? 'FedEx')
  const [refreshing, setRefreshing] = useState(false)
  const [savingTracking, setSavingTracking] = useState(false)

  if (!batch) return <p className="text-xs text-slate-400">No sample batch found.</p>

  const isFedEx = batch.carrier?.toLowerCase().startsWith('fedex') ?? false

  async function saveTracking() {
    setSavingTracking(true)
    try {
      const res = await fetch(`/api/opportunities/${oppId}/samples`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batch.batch_id, tracking_number: trackingVal, carrier: carrierVal }),
      })
      if (res.ok) {
        const data = await res.json()
        onTrackingUpdated(batch.batch_id, trackingVal)
        if (data.batch) onBatchUpdated(data.batch)
        setEditTracking(false)
      }
    } finally {
      setSavingTracking(false)
    }
  }

  async function refreshTracking() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/tracking/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batch.batch_id }),
      })
      if (res.ok) {
        const data = await res.json()
        onBatchUpdated({
          batch_id: batch.batch_id,
          carrier_status: data.tracking.status,
          carrier_status_detail: data.tracking.statusDetail,
          estimated_delivery: data.tracking.estimatedDelivery,
          tracking_url: data.tracking.trackingUrl,
          last_tracked_at: new Date().toISOString(),
          delivery_status: data.delivery_status,
        })
        if (data.delivery_status === 'delivered') {
          onMarkDelivered()
        }
      }
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-3">
      <BatchSummary batch={batch} oppId={oppId} />

      {/* Tracking status display */}
      {batch.tracking_number ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Shipment Tracking</span>
            {batch.carrier && (
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-purple-100 text-purple-700">{batch.carrier}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-700">{batch.tracking_number}</span>
            {batch.tracking_url && (
              <a href={batch.tracking_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                <ExternalLink className="w-3 h-3" /> Track
              </a>
            )}
          </div>

          {/* FedEx auto-tracking status */}
          {isFedEx && batch.carrier_status && (
            <>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${CARRIER_STATUS_COLORS[batch.carrier_status] ?? CARRIER_STATUS_COLORS.unknown}`}>
                  {batch.carrier_status.replace('_', ' ')}
                </span>
                {batch.carrier_status_detail && (
                  <span className="text-xs text-slate-500 truncate">{batch.carrier_status_detail}</span>
                )}
              </div>
              {batch.estimated_delivery && (
                <p className="text-xs text-slate-500">
                  Est. delivery: {new Date(batch.estimated_delivery).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
              {batch.last_tracked_at && (
                <p className="text-xs text-slate-400">Last checked: {timeAgo(batch.last_tracked_at)}</p>
              )}
            </>
          )}

          {/* FedEx delivered banner */}
          {isFedEx && batch.carrier_status === 'delivered' && batch.delivery_status !== 'delivered' && (
            <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-slate-700 font-medium">FedEx shows this shipment as delivered!</span>
              <button
                onClick={onMarkDelivered}
                disabled={stageUpdating}
                className="text-xs font-medium text-slate-700 hover:underline"
              >
                Confirm
              </button>
            </div>
          )}

          {/* Non-FedEx note */}
          {!isFedEx && (
            <p className="text-xs text-slate-400 italic">Auto-tracking is available for FedEx shipments only.</p>
          )}
        </div>
      ) : (
        /* No tracking number — show entry form */
        canEdit && (
          <div className="rounded-lg border border-dashed border-slate-300 p-3 space-y-2">
            <p className="text-xs text-slate-500 font-medium">Add Tracking Number</p>
            <div className="flex items-center gap-2">
              <select value={carrierVal} onChange={(e) => setCarrierVal(e.target.value)} className="text-xs border border-slate-200 rounded px-2 py-1.5">
                {['FedEx', 'DHL', 'USPS', 'UPS', 'EMS', 'Other'].map((c) => <option key={c}>{c}</option>)}
              </select>
              <input
                value={trackingVal}
                onChange={(e) => setTrackingVal(e.target.value)}
                placeholder="Tracking number"
                className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5"
              />
              <button onClick={saveTracking} disabled={!trackingVal.trim() || savingTracking} className="text-xs text-slate-700 hover:underline disabled:opacity-50">
                {savingTracking ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )
      )}

      {canEdit && (
        <div className="flex gap-2">
          {/* Refresh tracking (FedEx only) */}
          {isFedEx && batch.tracking_number && (
            <button
              onClick={refreshTracking}
              disabled={refreshing}
              className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-medium py-2 rounded-lg transition-colors"
            >
              {refreshing ? 'Checking...' : 'Refresh Tracking'}
            </button>
          )}

          {/* Edit tracking */}
          {batch.tracking_number && !editTracking && (
            <button onClick={() => { setEditTracking(true); setTrackingVal(batch.tracking_number ?? '') }} className="text-xs text-blue-600 hover:underline py-2">
              Edit
            </button>
          )}

          {editTracking && (
            <div className="w-full space-y-2">
              <div className="flex items-center gap-2">
                <input value={trackingVal} onChange={(e) => setTrackingVal(e.target.value)} className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5" />
                <button onClick={saveTracking} disabled={savingTracking} className="text-xs text-slate-700 hover:underline disabled:opacity-50">
                  {savingTracking ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditTracking(false)} className="text-xs text-slate-400 hover:underline">Cancel</button>
              </div>
            </div>
          )}

          {/* Mark delivered manually */}
          <button
            onClick={onMarkDelivered}
            disabled={stageUpdating}
            className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-lg transition-colors"
          >
            {stageUpdating ? 'Updating...' : 'Mark Delivered'}
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pending Draft Messages
// ---------------------------------------------------------------------------

function cleanPhoneForWhatsApp(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

function extractIgHandle(url: string): string | null {
  try {
    const cleaned = url.replace(/\/+$/, '')
    const parts = cleaned.split('/')
    const handle = parts[parts.length - 1]
    return handle && handle !== '' ? handle.replace(/^@/, '') : null
  } catch {
    return null
  }
}

function PendingDraftsSection({
  drafts, customer, onDraftUpdated,
}: {
  drafts: DraftMessage[]
  customer: OpportunityRow['customer']
  onDraftUpdated: (draftId: string, status: 'sent' | 'dismissed') => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const hasIg = !!(customer.instagram_url || customer.instagram_handle)
  const hasPhone = !!customer.phone
  const hasEmail = !!customer.email

  async function patchDraft(draftId: string, body: Record<string, unknown>) {
    await fetch(`/api/drafts/${draftId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  async function handleSendIg(draft: DraftMessage) {
    const handle = customer.instagram_url ? extractIgHandle(customer.instagram_url) : customer.instagram_handle
    if (!handle) return
    await navigator.clipboard.writeText(draft.message_text)
    window.open(`https://ig.me/m/${handle}`, '_blank')
    await patchDraft(draft.draft_id, { status: 'sent' })
    onDraftUpdated(draft.draft_id, 'sent')
  }

  async function handleSendWhatsApp(draft: DraftMessage) {
    if (!customer.phone) return
    const cleaned = cleanPhoneForWhatsApp(customer.phone)
    window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(draft.message_text)}`, '_blank')
    await patchDraft(draft.draft_id, { status: 'sent' })
    onDraftUpdated(draft.draft_id, 'sent')
  }

  async function handleSendEmail(draft: DraftMessage) {
    if (!customer.email) return
    const subject = encodeURIComponent('Your Hisa Matcha Samples')
    const body = encodeURIComponent(draft.message_text)
    window.open(`mailto:${customer.email}?subject=${subject}&body=${body}`, '_blank')
    await patchDraft(draft.draft_id, { status: 'sent' })
    onDraftUpdated(draft.draft_id, 'sent')
  }

  async function handleDismiss(draftId: string) {
    await patchDraft(draftId, { status: 'dismissed' })
    onDraftUpdated(draftId, 'dismissed')
  }

  async function handleSaveEdit(draftId: string) {
    await patchDraft(draftId, { message_text: editText })
    setEditingId(null)
  }

  const TRIGGER_LABELS: Record<string, string> = {
    samples_shipped: 'Samples Shipped',
    samples_delivered: 'Samples Delivered',
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pending Messages</h3>
      {drafts.map((draft) => (
        <div key={draft.draft_id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-700">{TRIGGER_LABELS[draft.trigger_event] ?? draft.trigger_event} — draft</span>
            <button onClick={() => handleDismiss(draft.draft_id)} className="text-xs text-slate-400 hover:text-slate-600">Dismiss</button>
          </div>

          {editingId === draft.draft_id ? (
            <div className="space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={6}
                className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 resize-none"
              />
              <div className="flex gap-2">
                <button onClick={() => handleSaveEdit(draft.draft_id)} className="text-xs text-slate-700 hover:underline">Save</button>
                <button onClick={() => setEditingId(null)} className="text-xs text-slate-400 hover:underline">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-700 whitespace-pre-line line-clamp-4">{draft.message_text}</p>
              <button
                onClick={() => { setEditingId(draft.draft_id); setEditText(draft.message_text) }}
                className="text-xs text-blue-600 hover:underline"
              >
                Edit
              </button>
            </>
          )}

          <div className="flex flex-wrap gap-2">
            {hasIg && (
              <button onClick={() => handleSendIg(draft)} className="px-3 py-1 text-xs font-medium rounded-md bg-pink-100 text-pink-700 hover:bg-pink-200 transition-colors">
                Send via IG
              </button>
            )}
            {hasPhone && (
              <button onClick={() => handleSendWhatsApp(draft)} className="px-3 py-1 text-xs font-medium rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
                Send via WhatsApp
              </button>
            )}
            {hasEmail && (
              <button onClick={() => handleSendEmail(draft)} className="px-3 py-1 text-xs font-medium rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors">
                Send via Email
              </button>
            )}
            {!hasIg && !hasPhone && !hasEmail && (
              <p className="text-xs text-amber-600">No contact info found — add Instagram, phone, or email on the lead detail page</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delivered (samples_delivered) — Feedback + Quote
// ---------------------------------------------------------------------------

function DeliveredSection({
  oppId, batches, products, allTiers, settings, customerName, canEdit, stageUpdating, onQuoteSaved, onAdvance, onFeedbackUpdated,
}: {
  oppId: string
  batches: SampleBatch[]
  products: Product[]
  allTiers: PricingTier[]
  settings: CrmSetting[]
  customerName: string | null
  canEdit: boolean
  stageUpdating: boolean
  onQuoteSaved: (p: Proposal) => void
  onAdvance: () => void
  onFeedbackUpdated: (batchId: string, itemId: string, feedback: string) => void
}) {
  const batch = batches[0]
  const [savedProposal, setSavedProposal] = useState<Proposal | null>(null)

  return (
    <div className="space-y-4">
      {/* Feedback */}
      {batch && (
        <div className="border border-slate-200 rounded-lg p-3 space-y-2">
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sample Feedback</h3>
          {batch.items.map((item) => (
            <FeedbackRow
              key={item.item_id}
              item={item}
              canEdit={canEdit}
              onUpdate={(fb) => onFeedbackUpdated(batch.batch_id, item.item_id, fb)}
            />
          ))}
        </div>
      )}

      {/* Quote builder */}
      {!savedProposal ? (
        <QuoteBuilder
          oppId={oppId}
          products={products}
          allTiers={allTiers}
          settings={settings}
          customerName={customerName}
          canEdit={canEdit}
          onSaved={(p) => {
            setSavedProposal(p)
            onQuoteSaved(p)
          }}
        />
      ) : (
        <QuoteSummary
          proposal={savedProposal}
          products={products}
          allTiers={allTiers}
          settings={settings}
          customerName={customerName}
          canEdit={canEdit}
          stageUpdating={stageUpdating}
          onAdvance={onAdvance}
        />
      )}
    </div>
  )
}

function FeedbackRow({ item, canEdit, onUpdate }: { item: SampleBatchItem; canEdit: boolean; onUpdate: (fb: string) => void }) {
  const [saving, setSaving] = useState(false)
  const feedbackOptions = [
    { value: 'positive', label: 'Liked', color: 'bg-green-100 text-green-700 border-green-300' },
    { value: 'neutral', label: 'Neutral', color: 'bg-amber-100 text-amber-700 border-amber-300' },
    { value: 'negative', label: 'Disliked', color: 'bg-red-100 text-red-700 border-red-300' },
    { value: 'pending', label: 'Pending', color: 'bg-slate-100 text-slate-500 border-slate-300' },
  ]

  async function handleClick(fb: string) {
    if (!canEdit || saving) return
    setSaving(true)
    // Note: we don't have a dedicated PATCH endpoint for individual items yet,
    // so we update locally for now
    onUpdate(fb)
    setSaving(false)
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-700 truncate flex-1">{item.product_snapshot ?? 'Item'} ×{item.qty_grams ?? 1}</span>
      <div className="flex gap-1">
        {feedbackOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleClick(opt.value)}
            className={`px-1.5 py-0.5 text-[10px] font-medium rounded border transition-colors ${
              item.feedback === opt.value ? opt.color : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quote Builder
// ---------------------------------------------------------------------------

function QuoteBuilder({
  oppId, products, allTiers, settings, customerName, canEdit, onSaved,
}: {
  oppId: string
  products: Product[]
  allTiers: PricingTier[]
  settings: CrmSetting[]
  customerName: string | null
  canEdit: boolean
  onSaved: (p: Proposal) => void
}) {
  const [currency, setCurrency] = useState<QuoteCurrency>('USD')
  const [lines, setLines] = useState<{ product_id: string; volume_kg: number; override_price?: number }[]>([
    { product_id: '', volume_kg: 0 },
  ])
  const [quoteNotes, setQuoteNotes] = useState('')
  const [sendVia, setSendVia] = useState('ig')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const thresholds = parseMarginThresholds(settings)

  const calculated: (QuoteLineResult | null)[] = lines.map((line) => {
    if (!line.product_id || line.volume_kg <= 0) return null
    const product = products.find((p) => p.product_id === line.product_id)
    if (!product) return null
    const productTiers = allTiers.filter((t) => t.product_id === line.product_id)
    return calculateQuoteLine(
      { product_id: line.product_id, volume_kg: line.volume_kg, override_price_per_kg: line.override_price },
      product,
      productTiers,
      currency,
      thresholds,
    )
  })

  const total = calculated.reduce((s, c) => s + (c?.subtotal ?? 0), 0)

  function addLine() { setLines((prev) => [...prev, { product_id: '', volume_kg: 0 }]) }
  function removeLine(idx: number) { setLines((prev) => prev.filter((_, i) => i !== idx)) }
  function updateLine(idx: number, field: string, val: string | number) {
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l
      if (field === 'product_id') return { ...l, product_id: val as string, override_price: undefined }
      if (field === 'volume_kg') return { ...l, volume_kg: val as number, override_price: undefined }
      if (field === 'override_price') return { ...l, override_price: val as number }
      return l
    }))
  }

  // Auto-fill price when product/volume changes
  function getAutoPrice(productId: string, volumeKg: number): number | undefined {
    if (!productId || volumeKg <= 0) return undefined
    const product = products.find((p) => p.product_id === productId)
    if (!product) return undefined
    const productTiers = allTiers.filter((t) => t.product_id === productId)
    const tier = findApplicableTier(productTiers, volumeKg, currency)
    return tier ? tier.price_per_kg : (getSellingPriceForCurrency(product, currency) ?? undefined)
  }

  async function handleSave() {
    const validLines = calculated.filter(Boolean) as QuoteLineResult[]
    if (validLines.length === 0) { setErr('Add at least one product line'); return }
    setSubmitting(true)
    setErr(null)

    try {
      const res = await fetch(`/api/opportunities/${oppId}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sent_via: sendVia,
          notes: quoteNotes || null,
          default_currency: currency,
          items: validLines.map((l) => ({
            product_id: l.product_id,
            price_per_kg: l.final_price_per_kg,
            currency,
          })),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()
      onSaved(data.proposal)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save quote')
    } finally {
      setSubmitting(false)
    }
  }

  if (!canEdit) return null

  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-3">
      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Build Quote</h3>

      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500">Currency</label>
        <select value={currency} onChange={(e) => setCurrency(e.target.value as QuoteCurrency)} className="text-xs border border-slate-200 rounded px-2 py-1">
          <option value="USD">USD ($)</option>
          <option value="GBP">GBP (£)</option>
          <option value="EUR">EUR (€)</option>
        </select>
      </div>

      <div className="space-y-2">
        {lines.map((line, idx) => {
          const calc = calculated[idx]
          const autoPrice = getAutoPrice(line.product_id, line.volume_kg)
          return (
            <div key={idx} className="space-y-1">
              <div className="flex items-center gap-2">
                <select
                  value={line.product_id}
                  onChange={(e) => updateLine(idx, 'product_id', e.target.value)}
                  className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5"
                >
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.product_id} value={p.product_id}>{p.customer_facing_product_name ?? p.product_id}{p.tasting_headline ? ` — ${p.tasting_headline}` : ''}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  placeholder="kg"
                  value={line.volume_kg || ''}
                  onChange={(e) => updateLine(idx, 'volume_kg', parseFloat(e.target.value) || 0)}
                  className="w-16 text-xs border border-slate-200 rounded px-2 py-1.5 text-center"
                />
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder={autoPrice ? autoPrice.toFixed(2) : '$/kg'}
                  value={line.override_price ?? ''}
                  onChange={(e) => updateLine(idx, 'override_price', parseFloat(e.target.value) || 0)}
                  className="w-20 text-xs border border-slate-200 rounded px-2 py-1.5 text-center"
                />
                {calc && <MarginDot health={calc.margin_health} />}
                {lines.length > 1 && (
                  <button onClick={() => removeLine(idx)} className="text-slate-400 hover:text-red-500 text-xs">×</button>
                )}
              </div>
              {calc?.tier_name && (
                <span className="text-[10px] text-indigo-600 ml-1">{calc.tier_name}: -{calc.tier_discount_pct}%</span>
              )}
              {calc?.is_below_min && (
                <span className="text-[10px] text-red-500 ml-1">Below min price!</span>
              )}
            </div>
          )
        })}
        <button onClick={addLine} className="text-xs text-slate-700 hover:underline">+ Add product</button>
      </div>

      {total > 0 && (
        <div className="flex justify-between text-sm font-medium border-t border-slate-100 pt-2">
          <span>Total</span>
          <span>{currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€'}{total.toFixed(2)}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Notes</label>
          <input value={quoteNotes} onChange={(e) => setQuoteNotes(e.target.value)} className="w-full text-xs border border-slate-200 rounded px-2 py-1.5" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Send via</label>
          <select value={sendVia} onChange={(e) => setSendVia(e.target.value)} className="w-full text-xs border border-slate-200 rounded px-2 py-1.5">
            <option value="ig">Instagram DM</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {err && <p className="text-xs text-red-500">{err}</p>}

      <button
        onClick={handleSave}
        disabled={submitting}
        className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
      >
        {submitting ? 'Saving…' : 'Save Quote'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quote Summary (after saving)
// ---------------------------------------------------------------------------

function QuoteSummary({
  proposal, products, allTiers, settings, customerName, canEdit, stageUpdating, onAdvance,
}: {
  proposal: Proposal
  products: Product[]
  allTiers: PricingTier[]
  settings: CrmSetting[]
  customerName: string | null
  canEdit: boolean
  stageUpdating: boolean
  onAdvance: () => void
}) {
  const [copied, setCopied] = useState(false)
  const currency = (proposal.default_currency ?? 'USD') as QuoteCurrency
  const thresholds = parseMarginThresholds(settings)

  const lineResults: QuoteLineResult[] = proposal.items.map((item) => {
    const product = products.find((p) => p.product_id === item.product_id)
    if (!product) {
      return {
        product_id: item.product_id,
        product_name: item.product?.customer_facing_product_name ?? item.product_id,
        volume_kg: 0,
        base_price_per_kg: item.price_per_kg,
        tier_name: null,
        tier_discount_pct: 0,
        final_price_per_kg: item.price_per_kg,
        subtotal: 0,
        landing_cost_per_kg: 0,
        gross_profit_per_kg: 0,
        gross_margin_pct: 0,
        margin_health: 'yellow' as const,
        is_below_min: false,
      }
    }
    const productTiers = allTiers.filter((t) => t.product_id === item.product_id)
    return calculateQuoteLine(
      { product_id: item.product_id, volume_kg: 0, override_price_per_kg: item.price_per_kg },
      product,
      productTiers,
      currency,
      thresholds,
    )
  })

  const total = proposal.items.reduce((s, item) => s + item.price_per_kg, 0)
  const message = generateQuoteMessage(lineResults, customerName, currency, proposal.notes ?? undefined)

  function handleCopy() {
    navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-3">
      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Quote Saved</h3>
      <div className="text-xs space-y-1">
        {proposal.items.map((item) => (
          <div key={item.item_id} className="flex justify-between">
            <span className="text-slate-700">{item.product?.customer_facing_product_name ?? item.product_id}</span>
            <div className="flex items-center gap-1">
              <span className="text-slate-600">{currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€'}{item.price_per_kg}/kg</span>
              {lineResults.find((l) => l.product_id === item.product_id) && (
                <MarginDot health={lineResults.find((l) => l.product_id === item.product_id)!.margin_health} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Copy-paste message */}
      <div className="bg-slate-50 rounded p-2 text-xs text-slate-700 whitespace-pre-wrap max-h-32 overflow-y-auto">
        {message}
      </div>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 text-xs text-slate-700 hover:underline"
      >
        {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy Message</>}
      </button>

      {canEdit && (
        <button
          onClick={onAdvance}
          disabled={stageUpdating}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          {stageUpdating ? 'Updating…' : 'Advance to Quote Sent'}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quote Sent (quote_sent)
// ---------------------------------------------------------------------------

function QuoteSentSection({
  proposals, products, allTiers, settings, customerName, canEdit, stageUpdating, onMarkWon, onMarkLost,
}: {
  proposals: Proposal[]
  products: Product[]
  allTiers: PricingTier[]
  settings: CrmSetting[]
  customerName: string | null
  canEdit: boolean
  stageUpdating: boolean
  onMarkWon: () => void
  onMarkLost: (reason: string) => void
}) {
  const latest = proposals[0]
  const [showLostInput, setShowLostInput] = useState(false)
  const [lostReason, setLostReason] = useState('')
  const [copied, setCopied] = useState(false)

  if (!latest) return <p className="text-xs text-slate-400">No quote found.</p>

  const currency = (latest.default_currency ?? 'USD') as QuoteCurrency
  const thresholds = parseMarginThresholds(settings)

  const lineResults: QuoteLineResult[] = latest.items.map((item) => {
    const product = products.find((p) => p.product_id === item.product_id)
    if (!product) return {
      product_id: item.product_id, product_name: item.product?.customer_facing_product_name ?? item.product_id,
      volume_kg: 0, base_price_per_kg: item.price_per_kg, tier_name: null, tier_discount_pct: 0,
      final_price_per_kg: item.price_per_kg, subtotal: 0, landing_cost_per_kg: 0,
      gross_profit_per_kg: 0, gross_margin_pct: 0, margin_health: 'yellow' as const, is_below_min: false,
    }
    return calculateQuoteLine(
      { product_id: item.product_id, volume_kg: 0, override_price_per_kg: item.price_per_kg },
      product, allTiers.filter((t) => t.product_id === item.product_id), currency, thresholds,
    )
  })

  const message = generateQuoteMessage(lineResults, customerName, currency, latest.notes ?? undefined)

  function handleCopy() {
    navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3">
      <div className="border border-slate-200 rounded-lg p-3 space-y-2">
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Quote</h3>
        <div className="text-xs space-y-1">
          {latest.items.map((item) => (
            <div key={item.item_id} className="flex justify-between">
              <span>{item.product?.customer_facing_product_name ?? item.product_id}</span>
              <div className="flex items-center gap-1">
                <span>{currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€'}{item.price_per_kg}/kg</span>
                <MarginDot health={lineResults.find((l) => l.product_id === item.product_id)?.margin_health ?? 'yellow'} />
              </div>
            </div>
          ))}
        </div>
        <div className="bg-slate-50 rounded p-2 text-xs text-slate-700 whitespace-pre-wrap max-h-32 overflow-y-auto">
          {message}
        </div>
        <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-slate-700 hover:underline">
          {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy Message</>}
        </button>
      </div>

      {canEdit && (
        <div className="flex gap-2">
          <button
            onClick={onMarkWon}
            disabled={stageUpdating}
            className="flex-1 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            {stageUpdating ? 'Updating…' : 'Mark Won'}
          </button>
          {!showLostInput ? (
            <button
              onClick={() => setShowLostInput(true)}
              className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg transition-colors"
            >
              Mark Lost
            </button>
          ) : (
            <div className="flex-1 flex gap-1">
              <input
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="Reason…"
                className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5"
                autoFocus
              />
              <button
                onClick={() => { onMarkLost(lostReason); setShowLostInput(false) }}
                disabled={stageUpdating}
                className="px-2 py-1 bg-red-600 text-white text-xs rounded"
              >
                Confirm
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Deal Won
// ---------------------------------------------------------------------------

function DealWonSection({
  customer, oppId, canEdit, hasProposals, onConverted,
}: {
  customer: OpportunityRow['customer']
  oppId: string
  canEdit: boolean
  hasProposals: boolean
  onConverted: () => void
}) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConvert() {
    setConverting(true)
    setError(null)
    try {
      const res = await fetch(`/api/opportunities/${oppId}/convert-recurring`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Conversion failed')
      onConverted()
      router.push('/recurring')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed')
      setConverting(false)
    }
  }

  return (
    <div className="border border-slate-200 bg-slate-50 rounded-lg p-4 text-center space-y-3">
      <div className="text-2xl">🎉</div>
      <h3 className="text-sm font-semibold text-slate-800">Deal Won!</h3>
      <p className="text-xs text-slate-700">{customer.cafe_name}</p>
      {customer.qualified_products && <p className="text-xs text-green-600">Products: {customer.qualified_products}</p>}
      {customer.qualified_volume_kg != null && <p className="text-xs text-green-600">Volume: {customer.qualified_volume_kg} kg/mo</p>}

      {canEdit && !showConfirm && (
        <button
          onClick={() => setShowConfirm(true)}
          className="w-full mt-2 px-3 py-2 text-xs font-medium rounded-md bg-slate-800 text-white hover:bg-slate-900 transition-colors"
        >
          Move to Recurring Customer
        </button>
      )}

      {showConfirm && (
        <div className="border border-green-300 bg-white rounded-lg p-3 text-left space-y-2 mt-2">
          <p className="text-xs font-medium text-slate-700">
            Move {customer.cafe_name} to Recurring Customers?
          </p>
          <ul className="text-xs text-slate-500 space-y-0.5 list-disc list-inside">
            <li>Mark this deal as complete</li>
            <li>Add to the Recurring Customers page</li>
            <li>Remove from active deals</li>
          </ul>
          {!hasProposals && (
            <p className="text-xs text-amber-600">
              No quote on file — the recurring order will be created without line items.
            </p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setShowConfirm(false)}
              disabled={converting}
              className="flex-1 px-2 py-1.5 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConvert}
              disabled={converting}
              className="flex-1 px-2 py-1.5 text-xs font-medium rounded bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {converting ? 'Converting...' : 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Call Logging
// ---------------------------------------------------------------------------

function CallLogSection({
  oppId, customerId, callLogs, canEdit, onCallLogged,
}: {
  oppId: string
  customerId: string
  callLogs: CallLog[]
  canEdit: boolean
  onCallLogged: (log: CallLog) => void
}) {
  const [open, setOpen] = useState(false)
  const [callType, setCallType] = useState('general')
  const [outcome, setOutcome] = useState('follow_up')
  const [duration, setDuration] = useState('')
  const [summary, setSummary] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSave() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/opportunities/${oppId}/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          call_type: callType,
          outcome,
          duration_minutes: duration ? parseInt(duration) : null,
          raw_summary: summary || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()
      onCallLogged(data.callLog)
      setCallType('general')
      setOutcome('follow_up')
      setDuration('')
      setSummary('')
      setOpen(false)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch {
      // silent
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg"
      >
        <span>Log a Call {success && <span className="text-green-600 ml-1">Saved!</span>}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && canEdit && (
        <div className="px-3 pb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">Type</label>
              <select value={callType} onChange={(e) => setCallType(e.target.value)} className="w-full text-xs border border-slate-200 rounded px-2 py-1">
                {Object.entries(CALL_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">Outcome</label>
              <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="w-full text-xs border border-slate-200 rounded px-2 py-1">
                {Object.entries(CALL_OUTCOME_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5">Duration (min)</label>
            <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full text-xs border border-slate-200 rounded px-2 py-1" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5">Notes</label>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} className="w-full text-xs border border-slate-200 rounded px-2 py-1 resize-none" />
          </div>
          <button
            onClick={handleSave}
            disabled={submitting}
            className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium py-1.5 rounded transition-colors"
          >
            {submitting ? 'Saving…' : 'Save Call'}
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recent Activity
// ---------------------------------------------------------------------------

function RecentActivity({
  batches, proposals, callLogs, oppId,
}: {
  batches: SampleBatch[]
  proposals: Proposal[]
  callLogs: CallLog[]
  oppId: string
}) {
  type ActivityItem = { type: string; title: string; date: string; summary: string }
  const items: ActivityItem[] = [
    ...batches.map((b) => ({
      type: 'sample',
      title: `Sample batch (${b.items.length} items)`,
      date: b.created_at,
      summary: b.carrier ? `via ${b.carrier}` : 'Created',
    })),
    ...proposals.map((p) => ({
      type: 'proposal',
      title: `Quote (${p.items.length} products)`,
      date: p.created_at,
      summary: `Sent via ${p.sent_via}`,
    })),
    ...callLogs.map((c) => ({
      type: 'call',
      title: `${CALL_TYPE_LABELS[c.call_type as keyof typeof CALL_TYPE_LABELS] ?? c.call_type} Call`,
      date: c.called_at,
      summary: c.raw_summary ? c.raw_summary.slice(0, 60) : (CALL_OUTCOME_LABELS[c.outcome as keyof typeof CALL_OUTCOME_LABELS] ?? c.outcome),
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3)

  const [open, setOpen] = useState(false)

  if (items.length === 0) return null

  return (
    <div className="border border-slate-200 rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg"
      >
        <span>Recent Activity ({items.length})</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2 text-xs">
              <span className="text-slate-400 shrink-0 w-14">{new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              <div className="min-w-0">
                <p className="text-slate-700 font-medium">{item.title}</p>
                <p className="text-slate-400 truncate">{item.summary}</p>
              </div>
            </div>
          ))}
          <Link href={`/opportunities/${oppId}`} className="text-xs text-slate-700 hover:underline block">
            View all →
          </Link>
        </div>
      )}
    </div>
  )
}
