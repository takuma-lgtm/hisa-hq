'use client'

import { useState, useMemo } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import type { InventoryLevelWithDetails } from '@/types/database'

interface Props {
  levels: InventoryLevelWithDetails[]
  exchangeRate: number
}

interface PivotedRow {
  sku_id: string
  sku_name: string
  product_name: string | null
  product_id: string | null
  sku_type: string
  unit_cost_jpy: number
  jp_stock: number
  us_stock: number
  in_transit: number
  total: number
  value_usd: number
}

type SortKey = 'sku_name' | 'sku_type' | 'jp_stock' | 'us_stock' | 'in_transit' | 'total' | 'value_usd'
type SortDir = 'asc' | 'desc'

export default function StockLevelsTable({ levels, exchangeRate }: Props) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [stockFilter, setStockFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Pivot levels by SKU — one row per SKU showing JP + US + In Transit
  const pivoted = useMemo(() => {
    const map = new Map<string, PivotedRow>()

    for (const level of levels) {
      const sku = level.sku
      if (!sku) continue

      const existing = map.get(level.sku_id)
      const shortCode = level.warehouse?.short_code

      if (existing) {
        if (shortCode === 'JP') {
          existing.jp_stock = level.quantity
        } else if (shortCode === 'US') {
          existing.us_stock = level.quantity
          existing.in_transit = level.in_transit_qty
        }
        existing.total = existing.jp_stock + existing.us_stock + existing.in_transit
        existing.value_usd = existing.total * (sku.unit_cost_jpy ?? 0) / exchangeRate
      } else {
        const jp = shortCode === 'JP' ? level.quantity : 0
        const us = shortCode === 'US' ? level.quantity : 0
        const transit = shortCode === 'US' ? level.in_transit_qty : 0
        const total = jp + us + transit
        map.set(level.sku_id, {
          sku_id: level.sku_id,
          sku_name: sku.sku_name,
          product_name: sku.name_external_eng,
          product_id: sku.product_id,
          sku_type: sku.sku_type,
          unit_cost_jpy: sku.unit_cost_jpy ?? 0,
          jp_stock: jp,
          us_stock: us,
          in_transit: transit,
          total,
          value_usd: total * (sku.unit_cost_jpy ?? 0) / exchangeRate,
        })
      }
    }

    return Array.from(map.values())
  }, [levels, exchangeRate])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let rows = pivoted.filter(row => {
      if (typeFilter && row.sku_type !== typeFilter) return false
      if (stockFilter === 'low' && row.total >= 5) return false
      if (stockFilter === 'out' && row.total !== 0) return false
      if (q) {
        const hay = [row.sku_name, row.product_name, row.product_id].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey]
        const bv = b[sortKey]
        if (av == null && bv == null) return 0
        if (av == null) return 1
        if (bv == null) return -1
        const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
        return sortDir === 'asc' ? cmp : -cmp
      })
    }

    return rows
  }, [pivoted, search, typeFilter, stockFilter, sortKey, sortDir])

  function statusBadge(total: number) {
    if (total === 0) return <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-500">Out</span>
    if (total < 5) return <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-50 text-red-600">Low</span>
    return <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-50 text-green-600">OK</span>
  }

  function typeBadge(type: string) {
    const colors: Record<string, string> = {
      Product: 'bg-green-50 text-green-700',
      Sample: 'bg-amber-50 text-amber-700',
      Retail: 'bg-blue-50 text-blue-700',
    }
    return (
      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${colors[type] || 'bg-slate-50 text-slate-600'}`}>
        {type}
      </span>
    )
  }

  const SortTh = ({ label, k, className }: { label: string; k: SortKey; className?: string }) => (
    <th
      className={`px-4 py-2 text-left text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-100 select-none ${className || ''}`}
      onClick={() => handleSort(k)}
    >
      {label}
      {sortKey === k && (sortDir === 'asc' ? ' ↑' : ' ↓')}
    </th>
  )

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-200 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search SKU or product..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Type filter pills */}
        {['', 'Product', 'Sample', 'Retail'].map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
              typeFilter === t
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {t || 'All'}
          </button>
        ))}

        {/* Stock filter */}
        <div className="relative ml-auto">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              showFilters || stockFilter
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-slate-200 text-slate-600'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Stock
          </button>
          {showFilters && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowFilters(false)} />
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-2">
                {[
                  { value: '', label: 'All Stock' },
                  { value: 'low', label: 'Low Stock (< 5)' },
                  { value: 'out', label: 'Out of Stock' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setStockFilter(opt.value); setShowFilters(false) }}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded ${
                      stockFilter === opt.value ? 'bg-green-50 text-green-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
            <tr>
              <SortTh label="SKU" k="sku_name" />
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Product</th>
              <SortTh label="Type" k="sku_type" />
              <SortTh label="JP Stock" k="jp_stock" className="text-right" />
              <SortTh label="US Stock" k="us_stock" className="text-right" />
              <SortTh label="In Transit" k="in_transit" className="text-right" />
              <SortTh label="Total" k="total" className="text-right" />
              <SortTh label="Value ($)" k="value_usd" className="text-right" />
              <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-slate-400 text-sm">
                  No inventory items found.
                </td>
              </tr>
            ) : (
              filtered.map(row => (
                <tr key={row.sku_id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{row.sku_name}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {row.product_name || row.product_id || '—'}
                  </td>
                  <td className="px-4 py-2.5">{typeBadge(row.sku_type)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{row.jp_stock}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{row.us_stock}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{row.in_transit || '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-900">{row.total}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                    ${row.value_usd.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-center">{statusBadge(row.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
