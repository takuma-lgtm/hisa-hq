'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import type { Customer, LeadStage, Profile } from '@/types/database'
import { LEAD_STAGE_LABELS } from '@/types/database'
import LeadSidePanel from './LeadSidePanel'

interface OutreachSummary {
  lastOutreachDate: string | null
  outreachCount: number
  daysSinceContact: number | null
  latestStatus: string | null
}

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  no_response:    { label: 'No Response',    classes: 'bg-slate-100 text-slate-600' },
  replied:        { label: 'Replied',        classes: 'bg-amber-100 text-amber-700' },
  interested:     { label: 'Interested',     classes: 'bg-green-100 text-green-700' },
  not_interested: { label: 'Not Interested', classes: 'bg-red-100 text-red-700' },
}

interface Props {
  leads: Customer[]
  profiles: Pick<Profile, 'id' | 'name'>[]
  outreachStats: Record<string, OutreachSummary>
  canEdit: boolean
}

type SortKey = 'cafe_name'
type SortDir = 'asc' | 'desc'

const SOURCE_STYLES: Record<string, { label: string; classes: string }> = {
  google_maps:        { label: 'Google Maps',  classes: 'bg-blue-50 text-blue-700' },
  gemini:             { label: 'Gemini',       classes: 'bg-purple-50 text-purple-700' },
  sheets_import:      { label: 'Sheets',       classes: 'bg-green-50 text-green-700' },
  apify_google_maps:  { label: 'Google Maps',  classes: 'bg-blue-50 text-blue-700' },
  manual:             { label: 'Manual',       classes: 'bg-slate-100 text-slate-600' },
}

function getSourceStyle(sourceType: string | null) {
  if (!sourceType) return { label: 'Sheets', classes: 'bg-green-50 text-green-700' }
  return SOURCE_STYLES[sourceType] ?? { label: sourceType, classes: 'bg-slate-100 text-slate-600' }
}

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

const STAGE_COLORS: Record<LeadStage, string> = {
  new_lead:     'bg-slate-100 text-slate-700',
  contacted:    'bg-blue-50 text-blue-700',
  replied:      'bg-amber-50 text-amber-700',
  qualified:    'bg-green-50 text-green-700',
  handed_off:   'bg-purple-50 text-purple-700',
  disqualified: 'bg-red-50 text-red-600',
}

function getDaysBadge(days: number | null) {
  if (days === null) return { label: '—', classes: 'text-slate-300' }
  if (days === 0) return { label: 'Today', classes: 'text-green-600 font-medium' }
  if (days <= 3) return { label: `${days}d ago`, classes: 'text-green-600 font-medium' }
  if (days <= 7) return { label: `${days}d ago`, classes: 'text-amber-600 font-medium' }
  return { label: `${days}d ago`, classes: 'text-red-600 font-medium' }
}

type FollowUpFilter = '' | 'needs_followup' | 'overdue' | 'no_outreach' | 'replied' | 'ready_to_convert'

export default function LeadsTable({ leads, profiles, outreachStats: initialOutreachStats, canEdit }: Props) {
  const [search, setSearch]             = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [stageFilter, setStageFilter]   = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpFilter>('')
  const [sortKey, setSortKey]           = useState<SortKey | null>(null)
  const [sortDir, setSortDir]           = useState<SortDir>('asc')
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [outreachStats, setOutreachStats] = useState(initialOutreachStats)
  const [leadStages, setLeadStages] = useState<Record<string, LeadStage>>(() => {
    const map: Record<string, LeadStage> = {}
    for (const l of leads) {
      if (l.lead_stage) map[l.customer_id] = l.lead_stage as LeadStage
    }
    return map
  })

  const containerRef = useRef<HTMLDivElement>(null)

  const profileMap = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.id, p.name])),
    [profiles],
  )

  const regions = useMemo(
    () => [...new Set(leads.map((l) => l.source_region).filter(Boolean))].sort() as string[],
    [leads],
  )

  const sources = useMemo(
    () => [...new Set(leads.map((l) => l.source_type).filter(Boolean))].sort() as string[],
    [leads],
  )

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const rows = leads.filter((l) => {
      if (regionFilter && l.source_region !== regionFilter) return false
      const effectiveStage = leadStages[l.customer_id] ?? l.lead_stage
      if (stageFilter && effectiveStage !== stageFilter) return false
      if (sourceFilter && (l.source_type ?? '') !== sourceFilter) return false

      // Follow-up filter
      if (followUpFilter) {
        const stats = outreachStats[l.customer_id]
        const days = stats?.daysSinceContact
        if (followUpFilter === 'no_outreach' && stats?.outreachCount !== 0) return false
        if (followUpFilter === 'needs_followup' && (days === null || days <= 3)) return false
        if (followUpFilter === 'overdue' && (days === null || days <= 7)) return false
        if (followUpFilter === 'replied' && stats?.latestStatus !== 'replied' && stats?.latestStatus !== 'interested') return false
        if (followUpFilter === 'ready_to_convert' && effectiveStage !== 'qualified') return false
      }

      if (q) {
        const hay = [l.cafe_name, l.city, l.country, l.contact_person, l.source_region, l.platform_used]
          .filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    if (!sortKey) return rows
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      if (av === '' && bv === '') return 0
      if (av === '') return 1
      if (bv === '') return -1
      const cmp = String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [leads, leadStages, search, regionFilter, stageFilter, sourceFilter, followUpFilter, outreachStats, sortKey, sortDir])

  function handleRowClick(leadId: string) {
    setSelectedLeadId((prev) => (prev === leadId ? null : leadId))
  }

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!selectedLeadId) return
      // Don't intercept when typing in inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Escape') {
        setSelectedLeadId(null)
        e.preventDefault()
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const idx = filtered.findIndex((l) => l.customer_id === selectedLeadId)
        if (idx === -1) return
        const next = e.key === 'ArrowDown' ? idx + 1 : idx - 1
        if (next >= 0 && next < filtered.length) {
          setSelectedLeadId(filtered[next].customer_id)
          e.preventDefault()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedLeadId, filtered])

  const selectedLead = selectedLeadId ? leads.find((l) => l.customer_id === selectedLeadId) : null
  const selectedOutreachStats = selectedLeadId
    ? outreachStats[selectedLeadId] ?? { lastOutreachDate: null, outreachCount: 0, daysSinceContact: null, latestStatus: null }
    : { lastOutreachDate: null, outreachCount: 0, daysSinceContact: null, latestStatus: null }

  // When qualification fields are saved, update local lead stage
  const handleLeadUpdated = useCallback((updated: Customer) => {
    if (updated.lead_stage) {
      setLeadStages((prev) => ({ ...prev, [updated.customer_id]: updated.lead_stage as LeadStage }))
    }
  }, [])

  // When a message is sent from the side panel, update local outreach stats
  const handleDataChanged = useCallback(() => {
    if (!selectedLeadId) return
    setOutreachStats((prev) => {
      const existing = prev[selectedLeadId] ?? { lastOutreachDate: null, outreachCount: 0, daysSinceContact: null, latestStatus: null }
      return {
        ...prev,
        [selectedLeadId]: {
          lastOutreachDate: new Date().toISOString(),
          outreachCount: existing.outreachCount + 1,
          daysSinceContact: 0,
          latestStatus: existing.latestStatus ?? 'no_response',
        },
      }
    })
    // Auto-advance stage from new_lead to contacted
    setLeadStages((prev) => {
      const current = prev[selectedLeadId]
      if (current === 'new_lead' || !current) {
        return { ...prev, [selectedLeadId]: 'contacted' }
      }
      return prev
    })
  }, [selectedLeadId])

  return (
    <div className="flex flex-1 overflow-hidden" ref={containerRef}>
      {/* Table section */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Filter bar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-200 shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              placeholder="Search leads…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Filters dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                showFilters ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {(() => {
                const count = [stageFilter, followUpFilter, regionFilter, sourceFilter].filter(Boolean).length
                return count > 0 ? (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-green-700 text-white leading-none">
                    {count}
                  </span>
                ) : null
              })()}
            </button>
            {showFilters && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowFilters(false)} />
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-3 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Stage</label>
                    <select
                      value={stageFilter}
                      onChange={(e) => setStageFilter(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">All stages</option>
                      {(Object.entries(LEAD_STAGE_LABELS) as [LeadStage, string][]).map(([v, label]) => (
                        <option key={v} value={v}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Follow-up</label>
                    <select
                      value={followUpFilter}
                      onChange={(e) => setFollowUpFilter(e.target.value as FollowUpFilter)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">All follow-up</option>
                      <option value="no_outreach">No outreach</option>
                      <option value="needs_followup">Needs follow-up (&gt;3d)</option>
                      <option value="overdue">Overdue (&gt;7d)</option>
                      <option value="replied">Replied / Interested</option>
                      <option value="ready_to_convert">Ready to Convert</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Region</label>
                    <select
                      value={regionFilter}
                      onChange={(e) => setRegionFilter(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">All regions</option>
                      {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Source</label>
                    <select
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">All sources</option>
                      {sources.map((s) => (
                        <option key={s} value={s}>{getSourceStyle(s).label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          <p className="ml-auto text-xs text-slate-400 shrink-0">{filtered.length} leads</p>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <p className="text-center py-20 text-slate-400 text-sm">No leads match your filters.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-white border-b border-slate-200 z-10">
                <tr>
                  <SortTh col="cafe_name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} first>Cafe Name</SortTh>
                  <Th>Location</Th>
                  <Th>Last Activity</Th>
                  <Th>Msgs</Th>
                  <Th>Reply Status</Th>
                  <Th>Source</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => {
                  const isSelected = lead.customer_id === selectedLeadId
                  const stats = outreachStats[lead.customer_id]
                  const activity = getDaysBadge(stats?.daysSinceContact ?? null)
                  return (
                    <tr
                      key={lead.customer_id}
                      onClick={() => handleRowClick(lead.customer_id)}
                      className={`border-b border-slate-100 cursor-pointer ${
                        isSelected ? 'bg-green-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="pl-6 pr-3 py-2 text-slate-900 font-medium max-w-[200px] truncate">
                        {lead.cafe_name}
                      </td>
                      <td className="px-3 py-2 text-slate-600 max-w-[140px] truncate">
                        {formatLocation(lead.city, lead.state, lead.country)}
                      </td>
                      <td className="px-2 py-2 text-xs whitespace-nowrap">
                        <span className={activity.classes}>{activity.label}</span>
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-600 whitespace-nowrap text-center">
                        {stats?.outreachCount || '—'}
                      </td>
                      <td className="px-2 py-2 text-xs whitespace-nowrap">
                        {(() => {
                          const status = stats?.latestStatus
                          if (!status) return <span className="text-slate-300">—</span>
                          const badge = STATUS_BADGE[status] ?? STATUS_BADGE.no_response
                          return (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badge.classes}`}>
                              {badge.label}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-3 py-2">
                        {(() => {
                          const s = getSourceStyle(lead.source_type)
                          return (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${s.classes}`}>
                              {s.label}
                            </span>
                          )
                        })()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Side panel */}
      {selectedLead && (
        <LeadSidePanel
          key={selectedLead.customer_id}
          lead={selectedLead}
          canEdit={canEdit}
          outreachStats={selectedOutreachStats}
          onClose={() => setSelectedLeadId(null)}
          onDataChanged={handleDataChanged}
          onLeadUpdated={handleLeadUpdated}
        />
      )}
    </div>
  )
}

function Th({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <th className={`${first ? 'pl-6' : 'pl-3'} pr-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap`}>
      {children}
    </th>
  )
}

function SortTh({
  children, col, sortKey, sortDir, onSort, first,
}: {
  children: React.ReactNode
  col: SortKey
  sortKey: SortKey | null
  sortDir: SortDir
  onSort: (k: SortKey) => void
  first?: boolean
}) {
  const active = sortKey === col
  return (
    <th
      onClick={() => onSort(col)}
      className={`${first ? 'pl-6' : 'pl-3'} pr-3 py-2 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap cursor-pointer select-none ${active ? 'text-green-700' : 'text-slate-500 hover:text-slate-800'}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <span className={`text-[10px] leading-none ${active ? 'text-green-600' : 'text-slate-300'}`}>
          {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </span>
    </th>
  )
}
