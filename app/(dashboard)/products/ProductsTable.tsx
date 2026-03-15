'use client'

import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { getMarginHealth, type MarginThresholds } from '@/lib/margin-health'
import type { Product } from '@/types/database'
import { Button } from '@/components/ui/button'
import ProductEditModal from './ProductEditModal'

interface Props {
  products: Product[]
  isAdmin: boolean
  marginThresholds: MarginThresholds
}

type SortKey =
  | 'supplier'
  | 'matcha_cost_per_kg_jpy'
  | 'selling_price_usd'
  | 'min_price_usd'
  | 'gross_profit_margin'
  | 'monthly_available_stock_kg'
type SortDir = 'asc' | 'desc'

export default function ProductsTable({ products, isAdmin, marginThresholds }: Props) {
  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Modal state
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [allProducts, setAllProducts] = useState(products)

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const suppliers = useMemo(
    () => [...new Set(allProducts.map((p) => p.supplier).filter(Boolean))].sort() as string[],
    [allProducts],
  )

  const types = useMemo(
    () => [...new Set(allProducts.map((p) => p.product_type).filter(Boolean))].sort() as string[],
    [allProducts],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const rows = allProducts.filter((p) => {
      if (!showInactive && !p.active) return false
      if (supplierFilter && p.supplier !== supplierFilter) return false
      if (typeFilter && p.product_type !== typeFilter) return false
      if (q) {
        const haystack = [
          p.customer_facing_product_name,
          p.product_id,
          p.supplier_product_name,
          p.name_internal_jpn,
          p.supplier,
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
  }, [allProducts, search, supplierFilter, typeFilter, showInactive, sortKey, sortDir])

  const activeCount = allProducts.filter((p) => p.active).length

  function handleRowClick(product: Product) {
    if (!isAdmin) return
    setEditProduct(product)
    setModalOpen(true)
  }

  function handleAddProduct() {
    setEditProduct(null)
    setModalOpen(true)
  }

  function handleSaved(updated: Product) {
    setAllProducts((prev) => {
      const idx = prev.findIndex((p) => p.product_id === updated.product_id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = updated
        return next
      }
      return [updated, ...prev]
    })
  }

  function fmt(val: number | null | undefined, type: 'usd' | 'jpy' | 'pct' | 'stock'): string {
    if (val == null) return '—'
    if (type === 'usd') return formatCurrency(val, 'USD')
    if (type === 'jpy') return `¥${val.toLocaleString()}`
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

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Products</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeCount} active product{activeCount !== 1 ? 's' : ''}
            {allProducts.length > activeCount && ` · ${allProducts.length} total`}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={handleAddProduct} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        )}
      </div>

      {/* Filter bar */}
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
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
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

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <p className="text-center py-20 text-slate-400 text-sm">No products match your filters.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-white border-b border-slate-200 z-10">
              <tr>
                <Th>Product</Th>
                <Th>Internal JPN</Th>
                <SortTh col="supplier" sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Supplier</SortTh>
                <Th>Type</Th>
                <SortTh col="matcha_cost_per_kg_jpy" right sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Cost (¥/kg)</SortTh>
                <SortTh col="selling_price_usd" right sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Price ($/kg)</SortTh>
                <SortTh col="min_price_usd" right sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Min ($)</SortTh>
                <SortTh col="gross_profit_margin" right sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Margin</SortTh>
                <SortTh col="monthly_available_stock_kg" right sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Stock/mo</SortTh>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.product_id}
                  onClick={() => handleRowClick(p)}
                  className={`border-b border-slate-100 hover:bg-slate-50 ${isAdmin ? 'cursor-pointer' : ''} ${!p.active ? 'opacity-50' : ''}`}
                >
                  <td className="px-3 py-2">
                    <div className="text-slate-900 font-medium truncate max-w-[180px]">
                      {p.customer_facing_product_name}
                    </div>
                    <div className="text-[10px] text-slate-400">{p.product_id}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-600 text-xs">{p.name_internal_jpn ?? p.supplier_product_name ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{p.supplier ?? '—'}</td>
                  <td className="px-3 py-2">
                    {p.product_type ? (
                      <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full">
                        {p.product_type}
                      </span>
                    ) : '—'}
                  </td>
                  <Td right>{fmt(p.matcha_cost_per_kg_jpy, 'jpy')}</Td>
                  <Td right>{fmt(p.selling_price_usd ?? p.default_selling_price_usd, 'usd')}</Td>
                  <Td right>{fmt(p.min_price_usd ?? p.min_selling_price_usd, 'usd')}</Td>
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

      {/* Edit/Create Modal */}
      {isAdmin && (
        <ProductEditModal
          product={editProduct}
          open={modalOpen}
          onOpenChange={setModalOpen}
          onSaved={handleSaved}
        />
      )}
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
      className={`px-3 py-2 text-xs font-medium uppercase tracking-wide whitespace-nowrap cursor-pointer select-none ${right ? 'text-right' : 'text-left'} ${active ? 'text-green-700' : 'text-slate-500 hover:text-slate-800'}`}
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
