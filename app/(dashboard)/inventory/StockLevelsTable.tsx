'use client'

import { useState, useMemo } from 'react'
import { Search, SlidersHorizontal, ChevronRight, ChevronDown } from 'lucide-react'
import type { InventoryLevelWithDetails } from '@/types/database'
import SKUDetailExpansion from './SKUDetailExpansion'

interface Props {
  levels: InventoryLevelWithDetails[]
  exchangeRate: number
  isAdmin?: boolean
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
  low_stock_threshold: number | null
}

interface ProductGroup {
  product_id: string
  product_name: string | null
  skus: PivotedRow[]
  sku_types: string[]
  jp_stock: number
  us_stock: number
  in_transit: number
  total: number
  value_usd: number
  worst_status: 'out' | 'low' | 'ok'
}

type SortKey = 'product_id' | 'jp_stock' | 'us_stock' | 'in_transit' | 'total' | 'value_usd'
type SortDir = 'asc' | 'desc'

function variantLabel(skuName: string, productId: string | null): string {
  if (!productId) return skuName
  const prefix = productId + '_'
  if (skuName.startsWith(prefix)) {
    return skuName.slice(prefix.length).replace(/_/g, ' ')
  }
  return skuName
}

function getSkuStatus(total: number, threshold: number | null): 'out' | 'low' | 'ok' {
  if (total === 0) return 'out'
  const limit = threshold ?? 5
  if (total < limit) return 'low'
  return 'ok'
}

export default function StockLevelsTable({ levels, exchangeRate }: Props) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [stockFilter, setStockFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey | null>('total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [expandedSkuId, setExpandedSkuId] = useState<string | null>(null)

  // Pivot levels by SKU
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
          low_stock_threshold: (sku as Record<string, unknown>).low_stock_threshold as number | null,
        })
      }
    }

    return Array.from(map.values())
  }, [levels, exchangeRate])

  // Available SKU types (derived from data)
  const availableTypes = useMemo(() => {
    const order = ['Product', 'Sample', 'Retail', 'Cans']
    const types = new Set(pivoted.map(r => r.sku_type))
    return Array.from(types).sort((a, b) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)))
  }, [pivoted])

  // Group by product_id, apply filters
  const groups = useMemo(() => {
    const q = search.toLowerCase()

    // Filter individual SKUs first
    const filteredSkus = pivoted.filter(row => {
      if (typeFilter === 'Retail' && row.sku_type !== 'Retail' && row.sku_type !== 'Cans') return false
      if (typeFilter && typeFilter !== 'Retail' && row.sku_type !== typeFilter) return false
      if (stockFilter === 'low') {
        const threshold = row.low_stock_threshold ?? 5
        if (row.total >= threshold) return false
      }
      if (stockFilter === 'out' && row.total !== 0) return false
      if (q) {
        const hay = [row.sku_name, row.product_name, row.product_id].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    // Group by product_id
    const groupMap = new Map<string, PivotedRow[]>()
    for (const row of filteredSkus) {
      const key = row.product_id || row.sku_name
      const existing = groupMap.get(key)
      if (existing) {
        existing.push(row)
      } else {
        groupMap.set(key, [row])
      }
    }

    // Build ProductGroup array
    let result: ProductGroup[] = []
    for (const [productId, skus] of groupMap) {
      // Sort children by total desc
      skus.sort((a, b) => b.total - a.total)

      const typeOrder = ['Product', 'Sample', 'Retail', 'Cans']
      const types = [...new Set(skus.map(s => s.sku_type))].sort((a, b) =>
        (typeOrder.indexOf(a) === -1 ? 99 : typeOrder.indexOf(a)) - (typeOrder.indexOf(b) === -1 ? 99 : typeOrder.indexOf(b))
      )
      result.push({
        product_id: productId,
        product_name: skus[0].product_name,
        skus,
        sku_types: types,
        jp_stock: skus.reduce((s, r) => s + r.jp_stock, 0),
        us_stock: skus.reduce((s, r) => s + r.us_stock, 0),
        in_transit: skus.reduce((s, r) => s + r.in_transit, 0),
        total: skus.reduce((s, r) => s + r.total, 0),
        value_usd: skus.reduce((s, r) => s + r.value_usd, 0),
        worst_status: getSkuStatus(skus.reduce((s, r) => s + r.total, 0), null),
      })
    }

    // Sort groups
    if (sortKey) {
      result = result.sort((a, b) => {
        const av = a[sortKey]
        const bv = b[sortKey]
        if (av == null && bv == null) return 0
        if (av == null) return 1
        if (bv == null) return -1
        const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
        return sortDir === 'asc' ? cmp : -cmp
      })
    }

    return result
  }, [pivoted, search, typeFilter, stockFilter, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function statusBadgeFromStatus(status: 'out' | 'low' | 'ok') {
    if (status === 'out') return <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-500">Out</span>
    if (status === 'low') return <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-50 text-red-600">Low</span>
    return <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-50 text-green-600">OK</span>
  }

  function statusBadge(total: number, threshold: number | null) {
    return statusBadgeFromStatus(getSkuStatus(total, threshold))
  }

  function typeBadge(type: string) {
    const colors: Record<string, string> = {
      Product: 'bg-green-50 text-green-700',
      Sample: 'bg-amber-50 text-amber-700',
      Retail: 'bg-blue-50 text-blue-700',
      Cans: 'bg-purple-50 text-purple-700',
    }
    return (
      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${colors[type] || 'bg-slate-50 text-slate-600'}`}>
        {type}
      </span>
    )
  }

  const colCount = 7

  function renderSortTh(label: string, k: SortKey, className?: string) {
    const isActive = sortKey === k
    return (
      <th
        key={k}
        className={`px-4 py-2 text-xs font-medium cursor-pointer hover:bg-slate-100 select-none ${isActive ? 'text-green-700 bg-green-50/50' : 'text-slate-500'} ${className || 'text-left'}`}
        onClick={() => handleSort(k)}
      >
        <span className={`inline-flex items-center gap-1 ${className?.includes('text-center') ? 'justify-center w-full' : ''}`}>
          {label}
          {isActive ? (
            <span className="text-green-600">{sortDir === 'asc' ? '▲' : '▼'}</span>
          ) : (
            <span className="text-slate-300 opacity-0 group-hover:opacity-100">▲</span>
          )}
        </span>
      </th>
    )
  }

  function toggleProduct(productId: string) {
    setExpandedProducts(prev => {
      const next = new Set(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      return next
    })
  }

  function toggleSku(skuId: string) {
    setExpandedSkuId(expandedSkuId === skuId ? null : skuId)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Hint */}
      <div className="flex items-center gap-2 px-6 py-2 bg-slate-50 border-b border-slate-200 shrink-0">
        <p className="text-xs text-slate-400">Click a product to see SKU variants, then click a variant for transaction history</p>
      </div>

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

        {/* Type filter pills — derived from in-stock types */}
        {['', ...availableTypes].map(t => (
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

        {/* Stock filter — cycles on click */}
        <button
          onClick={() => setStockFilter(f => f === '' ? 'low' : f === 'low' ? 'out' : '')}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            stockFilter === 'low'
              ? 'border-amber-500 bg-amber-50 text-amber-700'
              : stockFilter === 'out'
                ? 'border-red-500 bg-red-50 text-red-700'
                : 'border-slate-200 text-slate-600'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {stockFilter === 'low' ? 'Low Stock' : stockFilter === 'out' ? 'Out of Stock' : 'All Stock'}
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '8%' }} />
          </colgroup>
          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
            <tr>
              {renderSortTh("Product", "product_id")}
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Type</th>
              {renderSortTh("JP", "jp_stock", "text-center")}
              {renderSortTh("US", "us_stock", "text-center")}
              {renderSortTh("In Transit (JP→US)", "in_transit", "text-center")}
              {renderSortTh("Total", "total", "text-center")}
              {renderSortTh("Value ($)", "value_usd", "text-center")}
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={colCount + 1} className="px-4 py-12 text-center text-slate-400 text-sm">
                  No inventory items found.
                </td>
              </tr>
            ) : (
              groups.map(group => {
                const isProductExpanded = expandedProducts.has(group.product_id)
                return (
                  <ProductGroupRows
                    key={group.product_id}
                    group={group}
                    isProductExpanded={isProductExpanded}
                    expandedSkuId={expandedSkuId}
                    colCount={colCount}
                    onToggleProduct={() => toggleProduct(group.product_id)}
                    onToggleSku={toggleSku}
                    statusBadge={statusBadge}
                    statusBadgeFromStatus={statusBadgeFromStatus}
                    typeBadge={typeBadge}
                  />
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Product group rows ──────────────────────────────────────────────────────

function ProductGroupRows({
  group,
  isProductExpanded,
  expandedSkuId,
  colCount,
  onToggleProduct,
  onToggleSku,
  statusBadge,
  statusBadgeFromStatus,
  typeBadge,
}: {
  group: ProductGroup
  isProductExpanded: boolean
  expandedSkuId: string | null
  colCount: number
  onToggleProduct: () => void
  onToggleSku: (skuId: string) => void
  statusBadge: (total: number, threshold: number | null) => React.ReactNode
  statusBadgeFromStatus: (status: 'out' | 'low' | 'ok') => React.ReactNode
  typeBadge: (type: string) => React.ReactNode
}) {
  return (
    <>
      {/* Product parent row */}
      <tr
        className={`border-b border-slate-200 hover:bg-slate-50 cursor-pointer ${isProductExpanded ? 'bg-green-50/30' : ''}`}
        onClick={onToggleProduct}
      >
        <td className="pl-3 pr-2 py-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 shrink-0">
              {isProductExpanded
                ? <ChevronDown className="w-4 h-4 text-green-600" />
                : <ChevronRight className="w-4 h-4" />
              }
            </span>
            <div>
              <span className="font-semibold text-slate-900">{group.product_id}</span>
              {group.product_name && (
                <span className="block text-xs text-slate-400 mt-0.5">{group.product_name}</span>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-1 flex-wrap">
            {group.sku_types.map(t => (
              <span key={t}>{typeBadge(t)}</span>
            ))}
          </div>
        </td>
        <td className="px-4 py-3 text-center tabular-nums whitespace-nowrap font-medium text-slate-700">{group.jp_stock}</td>
        <td className="px-4 py-3 text-center tabular-nums whitespace-nowrap font-medium text-slate-700">{group.us_stock}</td>
        <td className="px-4 py-3 text-center tabular-nums whitespace-nowrap text-slate-500">{group.in_transit || '—'}</td>
        <td className="px-4 py-3 text-center tabular-nums whitespace-nowrap font-bold text-slate-900">{group.total}</td>
        <td className="px-4 py-3 text-center tabular-nums whitespace-nowrap font-medium text-slate-600">
          ${group.value_usd.toFixed(2)}
        </td>
        <td className="px-4 py-3 text-center">{statusBadgeFromStatus(group.worst_status)}</td>
      </tr>

      {/* Child SKU rows */}
      {isProductExpanded && group.skus.map((sku, i) => {
        const isLast = i === group.skus.length - 1
        const isSkuExpanded = expandedSkuId === sku.sku_id
        const label = variantLabel(sku.sku_name, sku.product_id)

        return (
          <SkuChildRows
            key={sku.sku_id}
            sku={sku}
            label={label}
            isLast={isLast}
            isSkuExpanded={isSkuExpanded}
            colCount={colCount}
            onToggleSku={() => onToggleSku(sku.sku_id)}
            statusBadge={statusBadge}
            typeBadge={typeBadge}
          />
        )
      })}
    </>
  )
}

// ── Child SKU rows ──────────────────────────────────────────────────────────

function SkuChildRows({
  sku,
  label,
  isLast,
  isSkuExpanded,
  colCount,
  onToggleSku,
  statusBadge,
  typeBadge,
}: {
  sku: PivotedRow
  label: string
  isLast: boolean
  isSkuExpanded: boolean
  colCount: number
  onToggleSku: () => void
  statusBadge: (total: number, threshold: number | null) => React.ReactNode
  typeBadge: (type: string) => React.ReactNode
}) {
  return (
    <>
      <tr
        className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer bg-white ${isSkuExpanded ? 'bg-slate-50' : ''}`}
        onClick={onToggleSku}
      >
        <td className="pl-8 pr-2 py-2 text-slate-700">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-slate-300 shrink-0">
              {isSkuExpanded
                ? <ChevronDown className="w-3.5 h-3.5 text-green-500" />
                : <ChevronRight className="w-3.5 h-3.5" />
              }
            </span>
            <span className="font-medium">{label}</span>
            <span className="text-xs text-slate-400">{sku.sku_name}</span>
          </span>
        </td>
        <td className="px-4 py-2">{typeBadge(sku.sku_type)}</td>
        <td className="px-4 py-2 text-center tabular-nums whitespace-nowrap text-slate-600">{sku.jp_stock}</td>
        <td className="px-4 py-2 text-center tabular-nums whitespace-nowrap text-slate-600">{sku.us_stock}</td>
        <td className="px-4 py-2 text-center tabular-nums whitespace-nowrap text-slate-400">{sku.in_transit || '—'}</td>
        <td className="px-4 py-2 text-center tabular-nums whitespace-nowrap font-medium text-slate-800">{sku.total}</td>
        <td className="px-4 py-2 text-center tabular-nums whitespace-nowrap text-slate-500">
          ${sku.value_usd.toFixed(2)}
        </td>
        <td className="px-4 py-2 text-center">{statusBadge(sku.total, sku.low_stock_threshold)}</td>
      </tr>
      {isSkuExpanded && (
        <tr>
          <td colSpan={colCount + 1} className="p-0">
            <SKUDetailExpansion skuId={sku.sku_id} skuName={sku.sku_name} />
          </td>
        </tr>
      )}
    </>
  )
}
