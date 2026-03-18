'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Search } from 'lucide-react'
import type { Customer, LeadStage, Profile } from '@/types/database'
import LeadSidePanel from './LeadSidePanel'
import { ResizableTable, type Employee } from '@/components/ui/resizable-table'

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
  google_maps:        { label: 'Google Maps',  classes: 'bg-slate-100 text-slate-500' },
  gemini:             { label: 'Gemini',       classes: 'bg-slate-100 text-slate-500' },
  sheets_import:      { label: 'Sheets',       classes: 'bg-slate-100 text-slate-500' },
  apify_google_maps:  { label: 'Google Maps',  classes: 'bg-slate-100 text-slate-500' },
  manual:             { label: 'Manual',       classes: 'bg-slate-100 text-slate-500' },
}

function getSourceStyle(sourceType: string | null) {
  if (!sourceType) return { label: 'Sheets', classes: 'bg-slate-100 text-slate-500' }
  return SOURCE_STYLES[sourceType] ?? { label: sourceType, classes: 'bg-slate-100 text-slate-500' }
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

const STAGE_BADGE: Record<string, { label: string; dot: string; classes: string }> = {
  new_lead:     { label: 'New',          dot: 'bg-slate-400',   classes: 'bg-slate-100 text-slate-600 border border-slate-300' },
  contacted:    { label: 'Contacted',    dot: 'bg-blue-500',    classes: 'bg-blue-50 text-blue-700 border border-blue-200' },
  replied:      { label: 'Replied',      dot: 'bg-green-500',   classes: 'bg-green-50 text-green-700 border border-green-200' },
  qualified:    { label: 'Qualified',    dot: 'bg-amber-500',   classes: 'bg-amber-50 text-amber-700 border border-amber-200' },
  handed_off:   { label: 'Promoted',     dot: 'bg-purple-500',  classes: 'bg-purple-50 text-purple-700 border border-purple-200' },
  disqualified: { label: 'Disqualified', dot: 'bg-red-400',     classes: 'bg-red-50 text-red-600 border border-red-200' },
}

// Quick filters (not funnel stages)
const QUICK_FILTERS = [
  { value: '', label: 'All' },
  { value: 'disqualified', label: 'Disqualified' },
]

// True funnel stages in order
const FUNNEL_STAGES = [
  { value: 'new_lead',   label: 'New' },
  { value: 'contacted',  label: 'Contacted' },
  { value: 'replied',    label: 'Replied' },
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

          {/* Stage filter bar — single unified row */}
          <div className="flex items-center gap-0">
            {/* All */}
            <button
              onClick={() => setActiveStage('')}
              className={`py-2 px-3 text-sm whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                activeStage === ''
                  ? 'border-green-600 text-green-700 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              All <span className="text-xs ml-0.5">{leads.length}</span>
            </button>

            {/* Separator */}
            <span className="text-slate-200 px-2 text-sm select-none">|</span>

            {/* Funnel stages with arrows — stepper/progress style */}
            {(() => {
              const activeFunnelIndex = FUNNEL_STAGES.findIndex(s => s.value === activeStage)
              return FUNNEL_STAGES.map(({ value, label }, i) => {
                const count = stageCounts[value] ?? 0
                const isActive = activeStage === value
                const isPast = activeFunnelIndex >= 0 && i < activeFunnelIndex
                const isFuture = activeFunnelIndex >= 0 && i > activeFunnelIndex
                const isLast = i === FUNNEL_STAGES.length - 1

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

                const arrowClass = isPast || isActive
                  ? 'text-green-300'
                  : 'text-slate-300'

                return (
                  <div key={value} className="flex items-center">
                    <button
                      onClick={() => setActiveStage(value)}
                      className={`py-2 px-3 text-sm whitespace-nowrap border-b-2 transition-colors cursor-pointer ${btnClass}`}
                    >
                      {label} <span className={`text-xs ml-0.5 ${countClass}`}>{count}</span>
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
              const isActive = activeStage === 'disqualified'
              return (
                <button
                  onClick={() => setActiveStage('disqualified')}
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
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-4 py-3">
          {filtered.length === 0 ? (
            <p className="text-center py-20 text-slate-400 text-sm">No leads match your filters.</p>
          ) : (
            <ResizableTable
              title="Cafe"
              employees={filtered.map((lead): Employee => {
                const stats = outreachStats[lead.customer_id]
                const effectiveStage = leadStages[lead.customer_id] ?? lead.lead_stage ?? 'new_lead'
                const stageBadge = STAGE_BADGE[effectiveStage] ?? STAGE_BADGE.new_lead
                const stageToStatus = (s: string): 'active' | 'inactive' | 'on-leave' => {
                  if (s === 'disqualified') return 'inactive'
                  if (s === 'handed_off') return 'on-leave'
                  return 'active'
                }
                return {
                  id: lead.customer_id,
                  name: lead.cafe_name ?? '—',
                  email: (() => {
                    const url = lead.website_url ?? lead.instagram_url
                    if (!url) return '—'
                    return url.startsWith('http') ? url : `https://${url}`
                  })(),
                  department: formatLocation(lead.city, lead.state, lead.country),
                  position: stageBadge.label,
                  salary: stats?.outreachCount ?? 0,
                  hireDate: lead.date_generated ?? lead.created_at ?? new Date().toISOString(),
                  status: stageToStatus(effectiveStage),
                }
              })}
              columnLabels={{
                email: 'Website',
                department: 'Location',
                position: 'Stage',
                salary: 'Messages',
                hireDate: 'Created',
              }}
              formatSalary={(n) => n === 0 ? '—' : `${n}×`}
              onEmployeeSelect={handleRowClick}
              enableAnimations={true}
              showCheckboxes={false}
              showToolbar={false}
              showStatus={false}
            />
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
