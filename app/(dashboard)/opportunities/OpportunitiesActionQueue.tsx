'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Search, Package, Truck, MessageSquare } from 'lucide-react'
import type { OpportunityStage, UserRole, Profile, Product, PaymentStatus } from '@/types/database'
import { OPPORTUNITY_STAGE_LABELS, OPPORTUNITY_STAGE_COLORS } from '@/lib/constants'
import OpportunitySidePanel from './OpportunitySidePanel'

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
  assigned_profile: Pick<Profile, 'id' | 'name' | 'role'> | null
}

interface BatchInfo {
  tracking_number: string | null
  carrier: string | null
  delivered_at: string | null
}

interface Props {
  opportunities: OpportunityRow[]
  profiles: Pick<Profile, 'id' | 'name'>[]
  products: Product[]
  userRole: UserRole
  invoiceStatuses?: Record<string, PaymentStatus>
  batchMap: Record<string, BatchInfo>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDaysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function formatDaysAgo(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

function urgencyClasses(days: number): string {
  if (days <= 5) return 'text-green-600 font-medium'
  if (days <= 10) return 'text-amber-600 font-medium'
  return 'text-red-600 font-semibold'
}

function formatLocation(city?: string | null, state?: string | null, country?: string | null): string {
  const isUS = country === 'United States' || country === 'US' || country === 'USA'
  const parts = [city, isUS ? state : country].filter(Boolean)
  return parts.join(', ') || '—'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-slate-400">{icon}</span>
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</h2>
      <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{count}</span>
    </div>
  )
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-400 mb-6">
      {message}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OpportunitiesActionQueue({
  opportunities,
  profiles,
  products,
  userRole,
  invoiceStatuses = {},
  batchMap,
}: Props) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [localStages, setLocalStages] = useState<Record<string, OpportunityStage>>({})
  const [delivering, setDelivering] = useState<Record<string, boolean>>({})
  const searchParams = useSearchParams()
  const router = useRouter()

  // Auto-select from query param
  useEffect(() => {
    const selected = searchParams.get('selected')
    if (selected && opportunities.some((o) => o.opportunity_id === selected)) {
      setSelectedId(selected)
      router.replace('/opportunities', { scroll: false })
    }
    const stageParam = searchParams.get('stage')
    if (stageParam) {
      router.replace('/opportunities', { scroll: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canEdit = userRole === 'owner' || userRole === 'admin'

  const handleStageChanged = useCallback((oppId: string, newStage: OpportunityStage) => {
    setLocalStages((prev) => ({ ...prev, [oppId]: newStage }))
  }, [])

  function effectiveStage(o: OpportunityRow): OpportunityStage {
    return localStages[o.opportunity_id] ?? o.stage
  }

  // Apply search filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return opportunities
    return opportunities.filter((o) => {
      const hay = [o.customer.cafe_name, o.customer.city, o.customer.country, o.customer.contact_person]
        .filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [opportunities, search])

  // Section buckets
  const readyToShip = useMemo(
    () => filtered.filter((o) => effectiveStage(o) === 'sample_approved'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, localStages],
  )

  const inTransit = useMemo(
    () => filtered.filter((o) => effectiveStage(o) === 'samples_shipped'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, localStages],
  )

  const needsAttention = useMemo(
    () =>
      filtered
        .filter((o) => {
          const s = effectiveStage(o)
          return s === 'samples_delivered' || s === 'quote_sent' || s === 'collect_feedback'
        })
        .sort((a, b) => {
          // Most overdue (oldest delivery) first
          const aRef = batchMap[a.opportunity_id]?.delivered_at ?? a.updated_at
          const bRef = batchMap[b.opportunity_id]?.delivered_at ?? b.updated_at
          return new Date(aRef).getTime() - new Date(bRef).getTime()
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, localStages, batchMap],
  )

  // Flatten all sections for keyboard navigation
  const allOrdered = useMemo(
    () => [...readyToShip, ...inTransit, ...needsAttention],
    [readyToShip, inTransit, needsAttention],
  )

  const activeCount = opportunities.filter(
    (o) => effectiveStage(o) !== 'disqualified' && effectiveStage(o) !== 'lost' && effectiveStage(o) !== 'deal_won',
  ).length

  function handleRowClick(id: string) {
    setSelectedId((prev) => (prev === id ? null : id))
  }

  async function markDelivered(oppId: string) {
    setDelivering((prev) => ({ ...prev, [oppId]: true }))
    const res = await fetch(`/api/opportunities/${oppId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'samples_delivered' }),
    })
    if (res.ok) handleStageChanged(oppId, 'samples_delivered')
    setDelivering((prev) => ({ ...prev, [oppId]: false }))
  }

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!selectedId) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Escape') {
        setSelectedId(null)
        e.preventDefault()
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const idx = allOrdered.findIndex((o) => o.opportunity_id === selectedId)
        if (idx === -1) return
        const next = e.key === 'ArrowDown' ? idx + 1 : idx - 1
        if (next >= 0 && next < allOrdered.length) {
          setSelectedId(allOrdered[next].opportunity_id)
          e.preventDefault()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedId, allOrdered])

  const selectedOpp = selectedId
    ? opportunities.find((o) => o.opportunity_id === selectedId) ?? null
    : null

  // ---------------------------------------------------------------------------
  // Row renders
  // ---------------------------------------------------------------------------

  function ReadyToShipRow({ o }: { o: OpportunityRow }) {
    const days = getDaysAgo(o.updated_at)
    const isSelected = selectedId === o.opportunity_id
    return (
      <div
        onClick={() => handleRowClick(o.opportunity_id)}
        className={`flex items-center gap-4 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
          isSelected
            ? 'border-green-300 bg-green-50'
            : 'border-slate-200 bg-white hover:bg-slate-50'
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-slate-900 truncate">
              {o.customer.cafe_name ?? '—'}
            </span>
            <span className="text-xs text-slate-400">
              {formatLocation(o.customer.city, o.customer.state, o.customer.country)}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
            {o.customer.qualified_products && (
              <span className="truncate max-w-[200px]">{o.customer.qualified_products}</span>
            )}
            {o.customer.qualified_volume_kg && (
              <span>{o.customer.qualified_volume_kg} kg/mo</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-xs ${urgencyClasses(days)}`}>
            Waiting {formatDaysAgo(days)}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); handleRowClick(o.opportunity_id) }}
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            Ship Samples →
          </button>
        </div>
      </div>
    )
  }

  function InTransitRow({ o }: { o: OpportunityRow }) {
    const batch = batchMap[o.opportunity_id]
    const days = getDaysAgo(o.updated_at)
    const isSelected = selectedId === o.opportunity_id
    const isDelivering = delivering[o.opportunity_id]
    return (
      <div
        onClick={() => handleRowClick(o.opportunity_id)}
        className={`flex items-center gap-4 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
          isSelected
            ? 'border-blue-300 bg-blue-50'
            : 'border-slate-200 bg-white hover:bg-slate-50'
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-slate-900 truncate">
              {o.customer.cafe_name ?? '—'}
            </span>
            <span className="text-xs text-slate-400">
              {formatLocation(o.customer.city, o.customer.state, o.customer.country)}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
            {batch?.carrier && <span>{batch.carrier}</span>}
            {batch?.tracking_number && (
              <a
                href={`https://tools.usps.com/go/TrackConfirmAction?tLabels=${batch.tracking_number}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-blue-600 hover:underline truncate max-w-[180px]"
              >
                {batch.tracking_number}
              </a>
            )}
            {!batch?.tracking_number && <span className="text-slate-400">No tracking</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-400">Shipped {formatDaysAgo(days)}</span>
          <button
            disabled={isDelivering}
            onClick={(e) => { e.stopPropagation(); markDelivered(o.opportunity_id) }}
            className="text-xs font-medium px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            {isDelivering ? 'Updating…' : 'Mark Delivered'}
          </button>
        </div>
      </div>
    )
  }

  function NeedsAttentionRow({ o }: { o: OpportunityRow }) {
    const stage = effectiveStage(o)
    const batch = batchMap[o.opportunity_id]
    const deliveredAt = batch?.delivered_at ?? o.updated_at
    const days = getDaysAgo(deliveredAt)
    const isSelected = selectedId === o.opportunity_id

    const quoteSent = stage === 'quote_sent' || stage === 'collect_feedback'
    const ctaLabel = stage === 'samples_delivered' ? 'Send Quote' : 'Follow Up'
    const ctaGreen = stage === 'samples_delivered'

    const stageLabel = OPPORTUNITY_STAGE_LABELS[stage] ?? stage
    const stageColor = OPPORTUNITY_STAGE_COLORS[stage] ?? 'bg-slate-100 text-slate-500 border border-slate-200'

    return (
      <div
        onClick={() => handleRowClick(o.opportunity_id)}
        className={`flex items-center gap-4 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
          isSelected
            ? 'border-green-300 bg-green-50'
            : 'border-slate-200 bg-white hover:bg-slate-50'
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-slate-900 truncate">
              {o.customer.cafe_name ?? '—'}
            </span>
            <span className="text-xs text-slate-400">
              {formatLocation(o.customer.city, o.customer.state, o.customer.country)}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full border ${stageColor}`}>
              {stageLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs">
            <span className={urgencyClasses(days)}>
              {days === 0 ? 'Delivered today' : `Delivered ${formatDaysAgo(days)}`}
            </span>
            <span className={quoteSent ? 'text-green-600' : 'text-slate-400'}>
              {quoteSent ? 'Quote ✓' : 'Quote —'}
            </span>
            <span className="text-slate-400">Feedback pending</span>
          </div>
        </div>
        <div className="shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); handleRowClick(o.opportunity_id) }}
            className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
              ctaGreen
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Search bar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-200 shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              placeholder="Search opportunities…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <span className="ml-auto text-xs text-slate-400">
            {activeCount} active deal{activeCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Sections */}
        <div className="flex-1 overflow-auto px-6 py-5 space-y-8">
          {/* Ready to Ship */}
          <div>
            <SectionHeader
              icon={<Package className="w-4 h-4" />}
              title="Ready to Ship"
              count={readyToShip.length}
            />
            {readyToShip.length === 0 ? (
              <EmptySection message="No samples approved yet. Convert qualified leads from the Leads page." />
            ) : (
              <div className="space-y-2">
                {readyToShip.map((o) => (
                  <ReadyToShipRow key={o.opportunity_id} o={o} />
                ))}
              </div>
            )}
          </div>

          {/* In Transit */}
          <div>
            <SectionHeader
              icon={<Truck className="w-4 h-4" />}
              title="In Transit"
              count={inTransit.length}
            />
            {inTransit.length === 0 ? (
              <EmptySection message="No shipments in transit." />
            ) : (
              <div className="space-y-2">
                {inTransit.map((o) => (
                  <InTransitRow key={o.opportunity_id} o={o} />
                ))}
              </div>
            )}
          </div>

          {/* Needs Quote + Feedback */}
          <div>
            <SectionHeader
              icon={<MessageSquare className="w-4 h-4" />}
              title="Needs Quote + Feedback"
              count={needsAttention.length}
            />
            {needsAttention.length === 0 ? (
              <EmptySection message="No samples waiting on quotes or feedback." />
            ) : (
              <div className="space-y-2">
                {needsAttention.map((o) => (
                  <NeedsAttentionRow key={o.opportunity_id} o={o} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Side panel */}
      {selectedOpp && (
        <OpportunitySidePanel
          opportunity={selectedOpp as never}
          userRole={userRole}
          canEdit={canEdit}
          products={products}
          onClose={() => setSelectedId(null)}
          onStageChanged={handleStageChanged}
        />
      )}
    </div>
  )
}
