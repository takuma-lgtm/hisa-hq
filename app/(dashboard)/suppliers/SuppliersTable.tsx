'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import type { Supplier, Profile, SupplierStage, SupplierBusinessType, SampleTrackingStatus } from '@/types/database'
import { SUPPLIER_STAGE_LABELS, SUPPLIER_BUSINESS_TYPE_LABELS, SAMPLE_STATUS_LABELS } from '@/types/database'
import { SUPPLIER_STAGE_COLORS, SUPPLIER_STAGE_ORDER, SUPPLIER_BUSINESS_TYPE_COLORS, SAMPLE_STATUS_COLORS } from '@/lib/constants'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import SupplierSidePanel from './SupplierSidePanel'

type SortKey = 'supplier_name' | 'prefecture' | 'stage' | 'business_type' | 'sample_status' | 'updated_at' | 'source'
type SortDir = 'asc' | 'desc'

interface SuppliersTableProps {
  suppliers: Supplier[]
  profiles: Profile[]
  commCounts: Record<string, number>
  canEdit: boolean
}

export default function SuppliersTable({ suppliers: initialSuppliers, profiles, commCounts: initialCommCounts, canEdit }: SuppliersTableProps) {
  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [commCounts, setCommCounts] = useState(initialCommCounts)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<SupplierStage | ''>('')
  const [prefectureFilter, setPrefectureFilter] = useState('')
  const [businessTypeFilter, setBusinessTypeFilter] = useState<SupplierBusinessType | ''>('')
  const [sampleStatusFilter, setSampleStatusFilter] = useState<SampleTrackingStatus | ''>('')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Update from props when parent re-fetches
  useEffect(() => {
    setSuppliers(initialSuppliers)
    setCommCounts(initialCommCounts)
  }, [initialSuppliers, initialCommCounts])

  // Unique prefectures for filter
  const prefectures = useMemo(() => {
    const set = new Set<string>()
    for (const s of suppliers) {
      if (s.prefecture) set.add(s.prefecture)
    }
    return Array.from(set).sort()
  }, [suppliers])

  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...suppliers]

    // Search
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((s) =>
        s.supplier_name.toLowerCase().includes(q) ||
        s.prefecture?.toLowerCase().includes(q) ||
        s.contact_person?.toLowerCase().includes(q) ||
        s.memo?.toLowerCase().includes(q) ||
        s.source?.toLowerCase().includes(q)
      )
    }

    // Filters
    if (stageFilter) list = list.filter((s) => s.stage === stageFilter)
    if (prefectureFilter) list = list.filter((s) => s.prefecture === prefectureFilter)
    if (businessTypeFilter) list = list.filter((s) => s.business_type === businessTypeFilter)
    if (sampleStatusFilter) list = list.filter((s) => s.sample_status === sampleStatusFilter)

    // Sort
    if (sortKey) {
      list.sort((a, b) => {
        const aVal = a[sortKey] ?? ''
        const bVal = b[sortKey] ?? ''
        if (sortKey === 'stage') {
          const aIdx = SUPPLIER_STAGE_ORDER.indexOf(aVal as SupplierStage)
          const bIdx = SUPPLIER_STAGE_ORDER.indexOf(bVal as SupplierStage)
          return sortDir === 'asc' ? aIdx - bIdx : bIdx - aIdx
        }
        const cmp = String(aVal).localeCompare(String(bVal), 'ja')
        return sortDir === 'asc' ? cmp : -cmp
      })
    }

    return list
  }, [suppliers, search, stageFilter, prefectureFilter, businessTypeFilter, sampleStatusFilter, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const handleRowClick = (id: string) => {
    setSelectedSupplierId((prev) => (prev === id ? null : id))
  }

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!selectedSupplierId) return
      if (e.key === 'Escape') {
        setSelectedSupplierId(null)
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const idx = filtered.findIndex((s) => s.supplier_id === selectedSupplierId)
        if (idx < 0) return
        const next = e.key === 'ArrowDown' ? idx + 1 : idx - 1
        if (next >= 0 && next < filtered.length) {
          setSelectedSupplierId(filtered[next].supplier_id)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedSupplierId, filtered])

  const selectedSupplier = selectedSupplierId
    ? suppliers.find((s) => s.supplier_id === selectedSupplierId) ?? null
    : null

  const showPanel = selectedSupplier != null

  const activeFilterCount = [stageFilter, prefectureFilter, businessTypeFilter, sampleStatusFilter].filter(Boolean).length

  const handleDataChanged = useCallback(() => {
    // Refresh comm counts
    fetch('/api/suppliers')
      .then((r) => r.json())
      .then((data) => {
        if (data.suppliers) setSuppliers(data.suppliers)
        if (data.commCounts) setCommCounts(data.commCounts)
      })
  }, [])

  const handleSupplierUpdated = useCallback((supplierId: string, updates: Partial<Supplier>) => {
    setSuppliers((prev) =>
      prev.map((s) => (s.supplier_id === supplierId ? { ...s, ...updates } : s))
    )
  }, [])

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-700 select-none"
      onClick={() => handleSort(field)}
    >
      {label}
      {sortKey === field && (
        <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
      )}
    </th>
  )

  const relativeDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return '今日'
    if (days === 1) return '昨日'
    if (days < 7) return `${days}日前`
    if (days < 30) return `${Math.floor(days / 7)}週間前`
    return d.toLocaleDateString('ja-JP')
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Table section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search + Filters bar */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md ${
              activeFilterCount > 0 ? 'border-green-300 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-green-700 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <span className="text-xs text-slate-400">{filtered.length} suppliers</span>
        </div>

        {/* Filter dropdowns */}
        {showFilters && (
          <div className="px-4 py-2 border-b border-slate-200 flex items-center gap-3 flex-wrap bg-slate-50">
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value as SupplierStage | '')}
              className="text-xs border border-slate-200 rounded px-2 py-1"
            >
              <option value="">All Stages</option>
              {SUPPLIER_STAGE_ORDER.map((s) => (
                <option key={s} value={s}>{SUPPLIER_STAGE_LABELS[s]}</option>
              ))}
            </select>
            <select
              value={prefectureFilter}
              onChange={(e) => setPrefectureFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded px-2 py-1"
            >
              <option value="">All Prefectures</option>
              {prefectures.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select
              value={businessTypeFilter}
              onChange={(e) => setBusinessTypeFilter(e.target.value as SupplierBusinessType | '')}
              className="text-xs border border-slate-200 rounded px-2 py-1"
            >
              <option value="">All Types</option>
              {(Object.entries(SUPPLIER_BUSINESS_TYPE_LABELS) as [SupplierBusinessType, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <select
              value={sampleStatusFilter}
              onChange={(e) => setSampleStatusFilter(e.target.value as SampleTrackingStatus | '')}
              className="text-xs border border-slate-200 rounded px-2 py-1"
            >
              <option value="">All Sample Status</option>
              {(Object.entries(SAMPLE_STATUS_LABELS) as [SampleTrackingStatus, string][])
                .filter(([val]) => val !== 'none')
                .map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
            </select>
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setStageFilter(''); setPrefectureFilter(''); setBusinessTypeFilter(''); setSampleStatusFilter('') }}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <X className="w-3 h-3" />Clear
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <SortHeader label="企業名" field="supplier_name" />
                <SortHeader label="都道府県" field="prefecture" />
                <SortHeader label="業態区分" field="business_type" />
                <SortHeader label="ステータス" field="stage" />
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">サンプル</th>
                <SortHeader label="最終更新" field="updated_at" />
                <SortHeader label="入り口" field="source" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">
                    No suppliers found
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr
                    key={s.supplier_id}
                    onClick={() => handleRowClick(s.supplier_id)}
                    className={`cursor-pointer transition-colors ${
                      selectedSupplierId === s.supplier_id
                        ? 'bg-green-50'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-3 py-2">
                      <span className="text-sm font-medium text-slate-900">{s.supplier_name}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{s.prefecture || '—'}</td>
                    <td className="px-3 py-2">
                      {s.business_type ? (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${SUPPLIER_BUSINESS_TYPE_COLORS[s.business_type]}`}>
                          {SUPPLIER_BUSINESS_TYPE_LABELS[s.business_type]}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${SUPPLIER_STAGE_COLORS[s.stage]}`}>
                        {SUPPLIER_STAGE_LABELS[s.stage]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {s.sample_status !== 'none' ? (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${SAMPLE_STATUS_COLORS[s.sample_status]}`}>
                          {SAMPLE_STATUS_LABELS[s.sample_status]}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {relativeDate(s.date_updated ?? s.updated_at)}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500 max-w-[120px] truncate">
                      {s.source || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side panel */}
      {showPanel && selectedSupplier && (
        <SupplierSidePanel
          supplier={selectedSupplier}
          canEdit={canEdit}
          commCount={commCounts[selectedSupplier.supplier_id] ?? 0}
          onClose={() => setSelectedSupplierId(null)}
          onDataChanged={handleDataChanged}
          onSupplierUpdated={handleSupplierUpdated}
        />
      )}
    </div>
  )
}
