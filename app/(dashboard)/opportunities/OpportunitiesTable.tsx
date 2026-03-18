'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import type { OpportunityStage, UserRole, Profile, Product, PaymentStatus } from '@/types/database'
import {
  OPPORTUNITY_TABLE_STAGES,
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGE_COLORS,
} from '@/lib/constants'
import OpportunitySidePanel from './OpportunitySidePanel'
import { ResizableTable, type Employee } from '@/components/ui/resizable-table'

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

interface Props {
  opportunities: OpportunityRow[]
  profiles: Pick<Profile, 'id' | 'name'>[]
  products: Product[]
  userRole: UserRole
  invoiceStatuses?: Record<string, PaymentStatus>
}

type SortKey = 'cafe_name' | 'days_in_stage'
type SortDir = 'asc' | 'desc'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COUNTRY_ABBR: Record<string, string> = {
  'United States': 'US', 'United Kingdom': 'UK', 'Canada': 'CA', 'Australia': 'AU',
  'Germany': 'DE', 'France': 'FR', 'Japan': 'JP', 'South Korea': 'KR',
  'Netherlands': 'NL', 'Italy': 'IT', 'Spain': 'ES', 'Brazil': 'BR',
  'Mexico': 'MX', 'Sweden': 'SE', 'Norway': 'NO', 'Denmark': 'DK',
  'Finland': 'FI', 'Switzerland': 'CH', 'Austria': 'AT', 'Belgium': 'BE',
  'Portugal': 'PT', 'Ireland': 'IE', 'New Zealand': 'NZ', 'Singapore': 'SG',
  'Hong Kong': 'HK', 'Taiwan': 'TW', 'Thailand': 'TH', 'Indonesia': 'ID',
  'Malaysia': 'MY', 'Philippines': 'PH', 'Vietnam': 'VN', 'India': 'IN',
  'China': 'CN', 'Poland': 'PL', 'Czech Republic': 'CZ', 'Romania': 'RO',
  'Hungary': 'HU', 'Greece': 'GR', 'Turkey': 'TR', 'South Africa': 'ZA',
  'United Arab Emirates': 'UAE', 'Saudi Arabia': 'SA', 'Israel': 'IL',
  'Argentina': 'AR', 'Chile': 'CL', 'Colombia': 'CO', 'Peru': 'PE',
}

function abbreviateCountry(country: string): string {
  return COUNTRY_ABBR[country] ?? country
}

function formatLocation(city?: string | null, state?: string | null, country?: string | null): string {
  const isUS = country === 'United States' || country === 'US' || country === 'USA'
  const parts = [city, state, !isUS && country ? abbreviateCountry(country) : null].filter(Boolean)
  return parts.join(', ') || '—'
}

function getDaysInStage(updatedAt: string): number {
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24))
}

function getDaysBadge(days: number) {
  if (days === 0) return { label: 'Today', classes: 'text-green-600 font-medium' }
  if (days <= 3) return { label: `${days}d`, classes: 'text-green-600 font-medium' }
  if (days <= 7) return { label: `${days}d`, classes: 'text-amber-600 font-medium' }
  return { label: `${days}d`, classes: 'text-red-600 font-medium' }
}

function truncate(s: string | null, max: number): string {
  if (!s) return '—'
  return s.length > max ? s.slice(0, max) + '…' : s
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OpportunitiesTable({ opportunities, profiles, products, userRole, invoiceStatuses = {} }: Props) {
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [localStages, setLocalStages] = useState<Record<string, OpportunityStage>>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const searchParams = useSearchParams()
  const router = useRouter()

  // Auto-select from query param (cross-page navigation)
  useEffect(() => {
    const selected = searchParams.get('selected')
    if (selected && opportunities.some((o) => o.opportunity_id === selected)) {
      setSelectedId(selected)
      router.replace('/opportunities', { scroll: false })
    }
    // Also support stage filter from query param
    const stageParam = searchParams.get('stage')
    if (stageParam) {
      setStageFilter(stageParam)
      router.replace('/opportunities', { scroll: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canEdit = userRole === 'owner' || userRole === 'admin'

  // Stage counts for filter bar
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const stage of OPPORTUNITY_TABLE_STAGES) counts[stage] = 0
    counts['disqualified'] = 0
    counts['lost'] = 0
    for (const o of opportunities) {
      const s = localStages[o.opportunity_id] ?? o.stage
      if (counts[s] !== undefined) counts[s]++
    }
    return counts
  }, [opportunities, localStages])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const rows = opportunities.filter((o) => {
      const effectiveStage = localStages[o.opportunity_id] ?? o.stage
      const isTerminal = effectiveStage === 'disqualified' || effectiveStage === 'lost'
      // Hide terminal stages unless explicitly filtered to them
      if (isTerminal && stageFilter !== effectiveStage) return false
      if (stageFilter && effectiveStage !== stageFilter) return false
      if (q) {
        const hay = [o.customer.cafe_name, o.customer.city, o.customer.country, o.customer.contact_person]
          .filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    if (!sortKey) return rows
    return [...rows].sort((a, b) => {
      if (sortKey === 'cafe_name') {
        const av = a.customer.cafe_name ?? ''
        const bv = b.customer.cafe_name ?? ''
        const cmp = av.localeCompare(bv)
        return sortDir === 'asc' ? cmp : -cmp
      }
      if (sortKey === 'days_in_stage') {
        const ad = getDaysInStage(a.updated_at)
        const bd = getDaysInStage(b.updated_at)
        const cmp = ad - bd
        return sortDir === 'asc' ? cmp : -cmp
      }
      return 0
    })
  }, [opportunities, localStages, search, stageFilter, sortKey, sortDir])

  function handleRowClick(id: string) {
    setSelectedId((prev) => (prev === id ? null : id))
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
        const idx = filtered.findIndex((o) => o.opportunity_id === selectedId)
        if (idx === -1) return
        const next = e.key === 'ArrowDown' ? idx + 1 : idx - 1
        if (next >= 0 && next < filtered.length) {
          setSelectedId(filtered[next].opportunity_id)
          e.preventDefault()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedId, filtered])

  const selectedOpp = selectedId ? opportunities.find((o) => o.opportunity_id === selectedId) ?? null : null

  const handleStageChanged = useCallback((oppId: string, newStage: OpportunityStage) => {
    setLocalStages((prev) => ({ ...prev, [oppId]: newStage }))
  }, [])

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return '⇅'
    return sortDir === 'asc' ? '▲' : '▼'
  }

  return (
    <div className="flex flex-1 overflow-hidden" ref={containerRef}>
      {/* Table section */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Filter bar */}
        <div className="px-6 py-3 border-b border-slate-200 shrink-0 space-y-3">
          <div className="flex items-center gap-3">
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
            <p className="ml-auto text-xs text-slate-400 shrink-0">
              {filtered.length} opportunit{filtered.length !== 1 ? 'ies' : 'y'}
            </p>
          </div>

          {/* Stage filter bar — sequential arrow format */}
          <div className="flex items-center gap-0">
            {/* All */}
            <button
              onClick={() => setStageFilter('')}
              className={`py-2 px-3 text-sm whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                stageFilter === ''
                  ? 'border-green-600 text-green-700 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              All <span className="text-xs ml-0.5">{opportunities.length}</span>
            </button>

            {/* Separator */}
            <span className="text-slate-200 px-2 text-sm select-none">|</span>

            {/* Pipeline stages with arrows */}
            {(() => {
              const activePipelineIndex = OPPORTUNITY_TABLE_STAGES.indexOf(stageFilter as OpportunityStage)
              return OPPORTUNITY_TABLE_STAGES.map((stage, i) => {
                const count = stageCounts[stage] ?? 0
                const isActive = stageFilter === stage
                const isPast = activePipelineIndex >= 0 && i < activePipelineIndex
                const isFuture = activePipelineIndex >= 0 && i > activePipelineIndex
                const isLast = i === OPPORTUNITY_TABLE_STAGES.length - 1

                const btnClass = isActive
                  ? 'border-green-600 text-green-700 font-bold'
                  : isPast
                  ? 'border-transparent text-green-500 hover:text-green-700'
                  : isFuture
                  ? 'border-transparent text-slate-400 hover:text-slate-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'

                const countClass = isActive
                  ? 'text-green-600'
                  : isPast
                  ? 'text-green-400'
                  : isFuture
                  ? 'text-slate-300'
                  : 'text-slate-400'

                const arrowClass = isPast || isActive ? 'text-green-300' : 'text-slate-300'

                return (
                  <div key={stage} className="flex items-center">
                    <button
                      onClick={() => setStageFilter(isActive ? '' : stage)}
                      className={`py-2 px-3 text-sm whitespace-nowrap border-b-2 transition-colors cursor-pointer ${btnClass}`}
                    >
                      {OPPORTUNITY_STAGE_LABELS[stage]} <span className={`text-xs ml-0.5 ${countClass}`}>{count}</span>
                    </button>
                    {!isLast && (
                      <span className={`text-xs select-none px-0.5 ${arrowClass}`}>→</span>
                    )}
                  </div>
                )
              })
            })()}

            {/* Separator */}
            <span className="text-slate-200 px-2 text-sm select-none">|</span>

            {/* Disqualified */}
            {(() => {
              const count = stageCounts['disqualified'] ?? 0
              const isActive = stageFilter === 'disqualified'
              return (
                <button
                  onClick={() => setStageFilter(isActive ? '' : 'disqualified')}
                  className={`py-2 px-3 text-sm whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                    isActive
                      ? 'border-red-500 text-red-600 font-semibold'
                      : count > 0
                      ? 'border-transparent text-red-400 hover:text-red-500 hover:border-red-200'
                      : 'border-transparent text-slate-300 hover:text-slate-400'
                  }`}
                >
                  Disqualified <span className="text-xs ml-0.5">{count}</span>
                </button>
              )
            })()}

            {/* · Lost */}
            <span className="text-slate-300 px-1 text-sm select-none">·</span>
            {(() => {
              const count = stageCounts['lost'] ?? 0
              const isActive = stageFilter === 'lost'
              return (
                <button
                  onClick={() => setStageFilter(isActive ? '' : 'lost')}
                  className={`py-2 px-3 text-sm whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                    isActive
                      ? 'border-slate-500 text-slate-700 font-semibold'
                      : count > 0
                      ? 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
                      : 'border-transparent text-slate-300 hover:text-slate-400'
                  }`}
                >
                  Lost <span className="text-xs ml-0.5">{count}</span>
                </button>
              )
            })()}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-4 py-3">
          {filtered.length === 0 ? (
            <p className="text-center py-20 text-slate-400 text-sm">No opportunities match your filters.</p>
          ) : (
            <>
              <ResizableTable
                title="Cafe"
                employees={filtered.map((o): Employee => {
                  const effectiveStage = localStages[o.opportunity_id] ?? o.stage
                  const stageToStatus = (s: string): 'active' | 'inactive' | 'on-leave' => {
                    if (s === 'disqualified' || s === 'lost') return 'inactive'
                    if (s === 'deal_won' || s === 'payment_received') return 'on-leave'
                    return 'active'
                  }
                  return {
                    id: o.opportunity_id,
                    name: o.customer.cafe_name ?? '—',
                    email: o.customer.email ?? o.customer.instagram_url ?? '—',
                    department: formatLocation(o.customer.city, o.customer.state, o.customer.country),
                    position: OPPORTUNITY_STAGE_LABELS[effectiveStage] ?? effectiveStage,
                    salary: o.customer.qualified_volume_kg ?? 0,
                    hireDate: o.created_at,
                    status: stageToStatus(effectiveStage),
                  }
                })}
                columnLabels={{
                  email: 'Contact',
                  department: 'Location',
                  position: 'Stage',
                  salary: 'Volume',
                  hireDate: 'Created',
                }}
                formatSalary={(n) => n === 0 ? '—' : `${n} kg/mo`}
                onEmployeeSelect={handleRowClick}
                showCheckboxes={false}
                showToolbar={false}
                showStatus={false}
                enableAnimations={true}
              />
              {filtered.length < 5 && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-sm text-slate-400">
                    {filtered.length} active {filtered.length === 1 ? 'deal' : 'deals'} in your pipeline.
                  </p>
                  <p className="text-xs text-slate-300 mt-1">
                    Convert more leads from the Leads page to grow your pipeline.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Side panel */}
      {selectedOpp && (
        <OpportunitySidePanel
          opportunity={selectedOpp as OpportunityRow}
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
