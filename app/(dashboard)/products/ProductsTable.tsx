'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { getMarginHealth, type MarginThresholds } from '@/lib/margin-health'
import type { Product } from '@/types/database'
import { Button } from '@/components/ui/button'
import ProductSidePanel from './ProductSidePanel'
import CompetitorGrid from './CompetitorGrid'

interface Props {
  products: Product[]
  isAdmin: boolean
  marginThresholds: MarginThresholds
}

type Tab = 'our' | 'competitor'
type SortKey =
  | 'supplier'
  | 'selling_price_usd'
  | 'gross_profit_margin'
  | 'monthly_available_stock_kg'
type SortDir = 'asc' | 'desc'

export default function ProductsTable({ products, isAdmin, marginThresholds }: Props) {
  const [tab, setTab] = useState<Tab>('our')
  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [allProducts, setAllProducts] = useState(products)

  // Side panel state
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [createMode, setCreateMode] = useState(false)

  const selectedProduct = useMemo(
    () => (selectedProductId ? allProducts.find((p) => p.product_id === selectedProductId) ?? null : null),
    [allProducts, selectedProductId],
  )

  // Our products (non-competitor)
  const ourProducts = useMemo(() => allProducts.filter((p) => !p.is_competitor), [allProducts])
  const competitorProducts = useMemo(() => allProducts.filter((p) => p.is_competitor), [allProducts])

  // Filtered + sorted our products
  const suppliers = useMemo(
    () => [...new Set(ourProducts.map((p) => p.supplier).filter(Boolean))].sort() as string[],
    [ourProducts],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const rows = ourProducts.filter((p) => {
      if (!showInactive && !p.active) return false
      if (supplierFilter && p.supplier !== supplierFilter) return false
      if (q) {
        const haystack = [
          p.customer_facing_product_name,
          p.product_id,
          p.supplier_product_name,
          p.name_internal_jpn,
          p.supplier,
          p.tasting_headline,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })

    if (!sortKey) return rows

    return [...rows].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = typeof av === 'string'
        ? av.localeCompare(bv as string)
        : (av as number) - (bv as number)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [ourProducts, search, supplierFilter, showInactive, sortKey, sortDir])

  const activeCount = ourProducts.filter((p) => p.active).length

  // Keyboard navigation
  const currentList = tab === 'our' ? filtered : competitorProducts

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!selectedProductId) return
      if (e.key === 'Escape') {
        setSelectedProductId(null)
        setCreateMode(false)
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const idx = currentList.findIndex((p) => p.product_id === selectedProductId)
        if (idx < 0) return
        const next = e.key === 'ArrowDown' ? idx + 1 : idx - 1
        if (next >= 0 && next < currentList.length) {
          setSelectedProductId(currentList[next].product_id)
          setCreateMode(false)
        }
      }
    },
    [selectedProductId, currentList],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function handleRowClick(productId: string) {
    setCreateMode(false)
    setSelectedProductId((prev) => (prev === productId ? null : productId))
  }

  function handleAdd() {
    setSelectedProductId(null)
    setCreateMode(true)
  }

  function handleSaved(updated: Product) {
    setAllProducts((prev) => {
      const idx = prev.findIndex((p) => p.product_id === updated.product_id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = updated
        return next
      }
      // New product — reset sort so it appears at top
      setSortKey(null)
      return [updated, ...prev]
    })
    setSelectedProductId(updated.product_id)
    setCreateMode(false)
  }

  function handleClosePanel() {
    setSelectedProductId(null)
    setCreateMode(false)
  }

  function fmt(val: number | null | undefined, type: 'usd' | 'pct' | 'stock'): string {
    if (val == null) return '—'
    if (type === 'usd') return formatCurrency(val, 'USD')
    if (type === 'pct') return `${(val * 100).toFixed(0)}%`
    if (type === 'stock') return val > 0 ? `~${val}kg` : '0kg'
    return '—'
  }

  function marginBadge(product: Product) {
    const health = getMarginHealth(product.gross_profit_margin, product.gross_profit_per_kg_usd, marginThresholds)
    const colors = {
      green: 'bg-green-100 text-green-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      red: 'bg-red-100 text-red-800',
    }
    const margin = product.gross_profit_margin
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${colors[health]}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${health === 'green' ? 'bg-green-500' : health === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'}`} />
        {margin != null ? `${(margin * 100).toFixed(0)}%` : '—'}
      </span>
    )
  }

  const showPanel = createMode || selectedProductId != null

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
        <div>
          <h1 className="text-2xl font-serif text-slate-900">Products</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {tab === 'our' ? (
              <>
                {activeCount} active product{activeCount !== 1 ? 's' : ''}
                {ourProducts.length > activeCount && ` · ${ourProducts.length} total`}
              </>
            ) : (
              <>{competitorProducts.length} competitor evaluation{competitorProducts.length !== 1 ? 's' : ''}</>
            )}
          </p>
        </div>
        {isAdmin && tab === 'our' && (
          <Button onClick={handleAdd} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-6 px-6 border-b border-slate-200 shrink-0">
        <button
          className={`pb-2.5 pt-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'our'
              ? 'border-slate-800 text-slate-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => { setTab('our'); setSelectedProductId(null); setCreateMode(false) }}
        >
          Our Products
        </button>
        <button
          className={`pb-2.5 pt-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'competitor'
              ? 'border-slate-800 text-slate-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => { setTab('competitor'); setSelectedProductId(null); setCreateMode(false) }}
        >
          Competitor Evaluations
        </button>
      </div>

      {/* Filter bar (our products only) */}
      {tab === 'our' && (
        <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-200 shrink-0 flex-wrap">
          <input
            type="search"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 max-w-sm text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-300"
            />
            Show inactive
          </label>
        </div>
      )}

      {/* Main content area: table/grid + side panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: table or grid */}
        {tab === 'our' ? (
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <div className="flex-1 overflow-auto">
              {filtered.length === 0 ? (
                <p className="text-center py-20 text-slate-400 text-sm">No products match your filters.</p>
              ) : (
                <table className="w-full text-sm border-collapse zebra-table">
                  <thead className="sticky top-0 bg-white border-b border-slate-200 z-10">
                    <tr>
                      <Th>Product</Th>
                      <Th>Region</Th>
                      <Th>Harvest</Th>
                      <SortTh col="selling_price_usd" right sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Price ($/kg)</SortTh>
                      <SortTh col="gross_profit_margin" right sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Margin</SortTh>
                      <SortTh col="monthly_available_stock_kg" right sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Stock/mo</SortTh>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr
                        key={p.product_id}
                        onClick={() => handleRowClick(p.product_id)}
                        className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${
                          selectedProductId === p.product_id ? 'bg-green-50/50' : ''
                        } ${!p.active ? 'opacity-50' : ''}`}
                      >
                        <td className="px-3 py-2">
                          <div className="text-slate-900 font-medium truncate max-w-[200px]">
                            {p.customer_facing_product_name}
                          </div>
                          {p.tasting_headline ? (
                            <div className="text-[10px] text-slate-400 italic truncate max-w-[200px]">{p.tasting_headline}</div>
                          ) : (
                            <div className="text-[10px] text-slate-400">{p.product_id}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600 text-xs">{p.production_region ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-600 text-xs">{p.harvest_season ?? p.harvest ?? '—'}</td>
                        <Td right>{fmt(p.selling_price_usd ?? p.default_selling_price_usd, 'usd')}</Td>
                        <td className="px-3 py-2 text-right">{marginBadge(p)}</td>
                        <Td right>{fmt(p.monthly_available_stock_kg, 'stock')}</Td>
                        <td className="px-3 py-2">
                          {p.active ? (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Active</span>
                          ) : (
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">Inactive</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          <CompetitorGrid
            products={competitorProducts}
            selectedId={selectedProductId}
            isAdmin={isAdmin}
            onSelect={(id) => handleRowClick(id)}
            onAdd={handleAdd}
          />
        )}

        {/* Right: side panel */}
        {showPanel && (
          <ProductSidePanel
            product={createMode ? null : selectedProduct}
            isCompetitor={tab === 'competitor'}
            isAdmin={isAdmin}
            marginThresholds={marginThresholds}
            onClose={handleClosePanel}
            onSaved={handleSaved}
          />
        )}
      </div>
    </>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}

function SortTh({
  children, col, right, sortKey, sortDir, onSort,
}: {
  children: React.ReactNode
  col: SortKey
  right?: boolean
  sortKey: SortKey | null
  sortDir: SortDir
  onSort: (k: SortKey) => void
}) {
  const active = sortKey === col
  return (
    <th
      className={`px-3 py-2 text-xs font-medium uppercase tracking-wide whitespace-nowrap cursor-pointer select-none ${right ? 'text-right' : 'text-left'} ${active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {right && <SortIndicator active={active} dir={sortDir} />}
        {children}
        {!right && <SortIndicator active={active} dir={sortDir} />}
      </span>
    </th>
  )
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`text-[10px] leading-none ${active ? 'text-green-600' : 'text-slate-300'}`}>
      {active ? (dir === 'asc' ? '\u25B2' : '\u25BC') : '\u21C5'}
    </span>
  )
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <td className={`px-3 py-2 text-slate-700 tabular-nums ${right ? 'text-right' : ''}`}>
      {children}
    </td>
  )
}
