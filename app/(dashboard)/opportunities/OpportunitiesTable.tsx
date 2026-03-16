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
  const [showClosed, setShowClosed] = useState(false)
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

  const canEdit = userRole === 'admin' || userRole === 'closer'

  // Stage counts for pills
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const stage of OPPORTUNITY_TABLE_STAGES) counts[stage] = 0
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
      if (isTerminal && !showClosed) return false
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
  }, [opportunities, localStages, search, stageFilter, showClosed, sortKey, sortDir])

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
        <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-200 shrink-0 flex-wrap">
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

          {/* Stage pills */}
          <div className="flex items-center gap-1.5">
            {OPPORTUNITY_TABLE_STAGES.map((stage) => {
              const active = stageFilter === stage
              return (
                <button
                  key={stage}
                  onClick={() => setStageFilter(active ? '' : stage)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                    active
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {OPPORTUNITY_STAGE_LABELS[stage]} ({stageCounts[stage] ?? 0})
                </button>
              )
            })}
          </div>

          {/* Show Closed toggle */}
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showClosed}
              onChange={(e) => setShowClosed(e.target.checked)}
              className="rounded border-slate-300 text-green-600 focus:ring-green-500"
            />
            Closed
          </label>

          <span className="ml-auto text-xs text-slate-400">
            {filtered.length} opportunit{filtered.length !== 1 ? 'ies' : 'y'}
          </span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                <th
                  className="px-6 py-2.5 cursor-pointer select-none hover:text-slate-700"
                  onClick={() => handleSort('cafe_name')}
                >
                  Café Name <span className="text-[10px]">{sortIndicator('cafe_name')}</span>
                </th>
                <th className="px-3 py-2.5">Location</th>
                <th className="px-3 py-2.5">Stage</th>
                <th className="px-3 py-2.5">Products</th>
                <th className="px-3 py-2.5">Volume</th>
                <th
                  className="px-3 py-2.5 cursor-pointer select-none hover:text-slate-700"
                  onClick={() => handleSort('days_in_stage')}
                >
                  Days <span className="text-[10px]">{sortIndicator('days_in_stage')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const effectiveStage = localStages[o.opportunity_id] ?? o.stage
                const days = getDaysInStage(o.updated_at)
                const daysBadge = getDaysBadge(days)
                const stageColor = OPPORTUNITY_STAGE_COLORS[effectiveStage] ?? 'bg-slate-100 text-slate-600'
                const isSelected = selectedId === o.opportunity_id

                return (
                  <tr
                    key={o.opportunity_id}
                    onClick={() => handleRowClick(o.opportunity_id)}
                    className={`border-b border-slate-100 cursor-pointer transition-colors ${
                      isSelected ? 'bg-green-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-6 py-2.5 max-w-[200px]">
                      <div className="font-medium text-slate-900 truncate">{o.customer.cafe_name ?? '—'}</div>
                      {o.customer.contact_person && (
                        <div className="text-xs text-slate-500 truncate">{o.customer.contact_person}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 max-w-[140px] truncate text-slate-600">
                      {formatLocation(o.customer.city, o.customer.state, o.customer.country)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1">
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${stageColor}`}>
                          {OPPORTUNITY_STAGE_LABELS[effectiveStage] ?? effectiveStage}
                        </span>
                        {invoiceStatuses[o.opportunity_id] === 'paid' && (
                          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Invoice paid" />
                        )}
                        {invoiceStatuses[o.opportunity_id] === 'pending' && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Invoice pending" />
                        )}
                        {invoiceStatuses[o.opportunity_id] === 'failed' && (
                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Invoice failed" />
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 max-w-[160px] text-slate-600" title={o.customer.qualified_products ?? ''}>
                      <span className="truncate block">{truncate(o.customer.qualified_products, 30)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                      {o.customer.qualified_volume_kg != null ? `${o.customer.qualified_volume_kg} kg/mo` : '—'}
                    </td>
                    <td className={`px-3 py-2.5 whitespace-nowrap ${daysBadge.classes}`}>
                      {daysBadge.label}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No opportunities match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
