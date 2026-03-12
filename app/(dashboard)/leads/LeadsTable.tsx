'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Customer, LeadStage, Profile } from '@/types/database'
import { LEAD_STAGE_LABELS } from '@/types/database'
import { formatDate } from '@/lib/utils'

interface Props {
  leads: Customer[]
  profiles: Pick<Profile, 'id' | 'name'>[]
}

type SortKey = 'cafe_name' | 'date_generated' | 'lead_stage' | 'source_region'
type SortDir = 'asc' | 'desc'

const STAGE_COLORS: Record<LeadStage, string> = {
  new_lead:     'bg-slate-100 text-slate-700',
  contacted:    'bg-blue-50 text-blue-700',
  replied:      'bg-amber-50 text-amber-700',
  qualified:    'bg-green-50 text-green-700',
  handed_off:   'bg-purple-50 text-purple-700',
  disqualified: 'bg-red-50 text-red-600',
}

export default function LeadsTable({ leads, profiles }: Props) {
  const router = useRouter()
  const [search, setSearch]           = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [stageFilter, setStageFilter]   = useState('')
  const [sortKey, setSortKey]           = useState<SortKey | null>(null)
  const [sortDir, setSortDir]           = useState<SortDir>('asc')

  const profileMap = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.id, p.name])),
    [profiles],
  )

  const regions = useMemo(
    () => [...new Set(leads.map((l) => l.source_region).filter(Boolean))].sort() as string[],
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
      if (stageFilter && l.lead_stage !== stageFilter) return false
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
  }, [leads, search, regionFilter, stageFilter, sortKey, sortDir])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-200 shrink-0">
        <input
          type="search"
          placeholder="Search leads…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-sm text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All regions</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All stages</option>
          {(Object.entries(LEAD_STAGE_LABELS) as [LeadStage, string][]).map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
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
                <Th>Serves Matcha</Th>
                <Th>Platform</Th>
                <SortTh col="source_region" sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Region</SortTh>
                <SortTh col="lead_stage" sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Status</SortTh>
                <Th>Assigned</Th>
                <SortTh col="date_generated" sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Date Generated</SortTh>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr
                  key={lead.customer_id}
                  onClick={() => router.push(`/leads/${lead.customer_id}`)}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="pl-6 pr-3 py-2 text-slate-900 font-medium max-w-[200px] truncate">
                    {lead.cafe_name}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {[lead.city, lead.country].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {lead.serves_matcha === null ? '—'
                      : lead.serves_matcha ? '✓ Yes' : '✗ No'}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{lead.platform_used ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{lead.source_region ?? '—'}</td>
                  <td className="px-3 py-2">
                    {lead.lead_stage ? (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[lead.lead_stage]}`}>
                        {LEAD_STAGE_LABELS[lead.lead_stage]}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {lead.lead_assigned_to ? (profileMap[lead.lead_assigned_to] ?? '—') : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {lead.date_generated ? formatDate(lead.date_generated) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
