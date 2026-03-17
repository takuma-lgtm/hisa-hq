'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Search } from 'lucide-react'
import type { Customer, LeadStage, Profile } from '@/types/database'
import LeadSidePanel from './LeadSidePanel'

interface OutreachSummary {
  lastOutreachDate: string | null
  outreachCount: number
  daysSinceContact: number | null
  latestStatus: string | null
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

const STAGE_BADGE: Record<string, { label: string; classes: string }> = {
  new_lead:     { label: 'New',          classes: 'bg-slate-100 text-slate-600' },
  contacted:    { label: 'Contacted',    classes: 'bg-blue-50 text-blue-700' },
  replied:      { label: 'Replied',      classes: 'bg-green-50 text-green-700' },
  qualified:    { label: 'Qualified',    classes: 'bg-amber-50 text-amber-700' },
  handed_off:   { label: 'Handed Off',   classes: 'bg-purple-50 text-purple-700' },
  disqualified: { label: 'Disqualified', classes: 'bg-red-50 text-red-600' },
}

// Stage pills for filtering
const STAGE_PILLS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'new_lead', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'replied', label: 'Replied' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'handed_off', label: 'Handed Off' },
]

function getDaysBadge(days: number | null) {
  if (days === null) return { label: '—', classes: 'text-slate-300', overdue: false }
  if (days === 0) return { label: 'Today', classes: 'text-green-600 font-medium', overdue: false }
  if (days <= 3) return { label: `${days}d ago`, classes: 'text-green-600 font-medium', overdue: false }
  if (days <= 7) return { label: `${days}d ago`, classes: 'text-amber-600 font-medium', overdue: false }
  return { label: `${days}d ago`, classes: 'text-red-600 font-medium', overdue: true }
}

export default function LeadsTable({ leads, profiles, outreachStats: initialOutreachStats, canEdit }: Props) {
  const [search, setSearch] = useState('')
  const [activeStage, setActiveStage] = useState('')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [outreachStats, setOutreachStats] = useState(initialOutreachStats)
  const [leadStages, setLeadStages] = useState<Record<string, LeadStage>>(() => {
    const map: Record<string, LeadStage> = {}
    for (const l of leads) {
      if (l.lead_stage) map[l.customer_id] = l.lead_stage as LeadStage
    }
    return map
  })

  const containerRef = useRef<HTMLDivElement>(null)

  // Stage counts for pills
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { '': leads.length }
    for (const l of leads) {
      const stage = leadStages[l.customer_id] ?? l.lead_stage ?? 'new_lead'
      counts[stage] = (counts[stage] || 0) + 1
    }
    return counts
  }, [leads, leadStages])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const rows = leads.filter((l) => {
      const effectiveStage = leadStages[l.customer_id] ?? l.lead_stage
      if (activeStage && effectiveStage !== activeStage) return false

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
  }, [leads, leadStages, search, activeStage, sortKey, sortDir])

  function handleRowClick(leadId: string) {
    setSelectedLeadId((prev) => (prev === leadId ? null : leadId))
  }

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!selectedLeadId) return
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

  const handleLeadUpdated = useCallback((updated: Customer) => {
    if (updated.lead_stage) {
      setLeadStages((prev) => ({ ...prev, [updated.customer_id]: updated.lead_stage as LeadStage }))
    }
  }, [])

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
        {/* Search + stage pills */}
        <div className="px-6 py-3 border-b border-slate-200 shrink-0 space-y-3">
          <div className="flex items-center gap-3">
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
            <p className="ml-auto text-xs text-slate-400 shrink-0">{filtered.length} leads</p>
          </div>

          {/* Stage pills */}
          <div className="flex gap-1">
            {STAGE_PILLS.map(({ value, label }) => {
              const count = stageCounts[value] ?? 0
              if (value && count === 0) return null
              const isActive = activeStage === value
              return (
                <button
                  key={value}
                  onClick={() => setActiveStage(value)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label} ({value === '' ? leads.length : count})
                </button>
              )
            })}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <p className="text-center py-20 text-slate-400 text-sm">No leads match your filters.</p>
          ) : (
            <table className="w-full text-sm border-collapse zebra-table">
              <thead className="sticky top-0 bg-white border-b border-slate-200 z-10">
                <tr>
                  <SortTh col="cafe_name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} first>Cafe Name</SortTh>
                  <Th>Location</Th>
                  <Th>Last Activity</Th>
                  <Th>Status</Th>
                  <Th>Source</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => {
                  const isSelected = lead.customer_id === selectedLeadId
                  const stats = outreachStats[lead.customer_id]
                  const activity = getDaysBadge(stats?.daysSinceContact ?? null)
                  const effectiveStage = leadStages[lead.customer_id] ?? lead.lead_stage ?? 'new_lead'
                  const stageBadge = STAGE_BADGE[effectiveStage] ?? STAGE_BADGE.new_lead
                  return (
                    <tr
                      key={lead.customer_id}
                      onClick={() => handleRowClick(lead.customer_id)}
                      className={`border-b border-slate-100 cursor-pointer ${
                        isSelected ? 'bg-green-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="pl-10 pr-3 py-2.5 text-slate-900 font-medium max-w-[200px] truncate">
                        {lead.cafe_name}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 max-w-[160px] truncate">
                        {formatLocation(lead.city, lead.state, lead.country)}
                      </td>
                      <td className="px-2 py-2.5 text-xs whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {activity.overdue && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Needs follow-up" />
                          )}
                          <span className={activity.classes}>{activity.label}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-xs whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${stageBadge.classes}`}>
                          {stageBadge.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
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
    <th className={`${first ? 'pl-10' : 'pl-3'} pr-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap`}>
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
      className={`${first ? 'pl-10' : 'pl-3'} pr-3 py-2 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap cursor-pointer select-none ${active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
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
