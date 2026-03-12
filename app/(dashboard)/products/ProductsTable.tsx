'use client'

import { useState, useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'
import type { Product } from '@/types/database'

interface Props {
  products: Product[]
  isAdmin: boolean
}

type ViewMode = 'table' | 'cards'
type SortKey = 'supplier' | 'monthly_available_stock_kg' | 'default_selling_price_usd' | 'min_selling_price_usd' | 'gross_profit_margin'
type SortDir = 'asc' | 'desc'

export default function ProductsTable({ products, isAdmin }: Props) {
  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [view, setView] = useState<ViewMode>('table')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const suppliers = useMemo(
    () => [...new Set(products.map((p) => p.supplier).filter(Boolean))].sort() as string[],
    [products],
  )

  const types = useMemo(
    () => [...new Set(products.map((p) => p.product_type).filter(Boolean))].sort() as string[],
    [products],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const rows = products.filter((p) => {
      if (supplierFilter && p.supplier !== supplierFilter) return false
      if (typeFilter && p.product_type !== typeFilter) return false
      if (q) {
        const haystack = [
          p.customer_facing_product_name,
          p.product_id,
          p.supplier_product_name,
          p.supplier,
          p.tasting_notes,
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
      // nulls always last regardless of direction
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = typeof av === 'string'
        ? av.localeCompare(bv as string)
        : (av as number) - (bv as number)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [products, search, supplierFilter, typeFilter, sortKey, sortDir])

  function fmt(val: number | null | undefined, type: 'currency' | 'pct' | 'stock'): string {
    if (val == null) return '—'
    if (type === 'currency') return formatCurrency(val)
    if (type === 'pct') return `${(val * 100).toFixed(0)}%`
    if (type === 'stock') return `~${val} kg`
    return '—'
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-200 shrink-0">
        <input
          type="search"
          placeholder="Search products…"
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

        {/* View toggle */}
        <div className="ml-auto flex rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => setView('table')}
            title="Table view"
            className={`px-2.5 py-1.5 text-slate-500 hover:text-slate-800 transition-colors ${view === 'table' ? 'bg-slate-100 text-slate-800' : ''}`}
          >
            <TableIcon />
          </button>
          <button
            onClick={() => setView('cards')}
            title="Card view"
            className={`px-2.5 py-1.5 text-slate-500 hover:text-slate-800 transition-colors border-l border-slate-200 ${view === 'cards' ? 'bg-slate-100 text-slate-800' : ''}`}
          >
            <GridIcon />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <p className="text-center py-20 text-slate-400 text-sm">No products match your filters.</p>
        ) : view === 'table' ? (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-white border-b border-slate-200 z-10">
              <tr>
                <Th>External ENG</Th>
                <Th>Internal ENG</Th>
                <Th>Internal JPN</Th>
                <SortTh col="supplier" sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Supplier</SortTh>
                <Th>Type</Th>
                <SortTh col="monthly_available_stock_kg" right sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Stock/mo</SortTh>
                <SortTh col="default_selling_price_usd" right sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Price/kg</SortTh>
                <SortTh col="min_selling_price_usd" right sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Min price</SortTh>
                {isAdmin && <Th right>Landing cost</Th>}
                {isAdmin && <SortTh col="gross_profit_margin" right sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Margin</SortTh>}
                <Th>Notes</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.product_id}
                  className={`border-b border-slate-100 hover:bg-slate-50 ${!p.active ? 'opacity-50' : ''}`}
                >
                  <td className={`px-3 py-2 text-slate-900 max-w-[180px] truncate ${!p.active ? 'italic' : ''}`}>
                    {p.customer_facing_product_name ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{p.product_id}</td>
                  <td className="px-3 py-2 text-slate-700">{p.supplier_product_name ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{p.supplier ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{p.product_type ?? '—'}</td>
                  <Td right>{fmt(p.monthly_available_stock_kg, 'stock')}</Td>
                  <Td right>{fmt(p.default_selling_price_usd ?? p.price_per_kg, 'currency')}</Td>
                  <Td right>{fmt(p.min_selling_price_usd, 'currency')}</Td>
                  {isAdmin && <Td right>{fmt(p.landing_cost_per_kg_usd, 'currency')}</Td>}
                  {isAdmin && <Td right>{fmt(p.gross_profit_margin, 'pct')}</Td>}
                  <td className="px-3 py-2 text-slate-500 max-w-[220px] truncate">{p.tasting_notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* Card view */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {filtered.map((p) => (
              <div
                key={p.product_id}
                className={`bg-white border rounded-xl p-5 ${p.active ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-900 leading-snug truncate">
                      {p.customer_facing_product_name}
                    </h3>
                    <p className="text-[10px] text-slate-400">{p.product_id}</p>
                    {p.supplier_product_name && (
                      <p className="text-[10px] text-slate-400">{p.supplier_product_name}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                    {!p.active && (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                    {p.product_type && (
                      <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full">
                        {p.product_type}
                      </span>
                    )}
                  </div>
                </div>

                {p.supplier && (
                  <p className="text-xs text-slate-500 mb-1">Supplier: {p.supplier}</p>
                )}

                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{p.tasting_notes ?? '—'}</p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <CardStat label="Default price/kg" value={fmt(p.default_selling_price_usd ?? p.price_per_kg, 'currency')} />
                  <CardStat label="Monthly stock" value={p.monthly_available_stock_kg != null ? fmt(p.monthly_available_stock_kg, 'stock') : '—'} />
                  {isAdmin && (
                    <>
                      {p.landing_cost_per_kg_usd != null && (
                        <CardStat label="Landing cost" value={fmt(p.landing_cost_per_kg_usd, 'currency')} />
                      )}
                      {p.min_selling_price_usd != null && (
                        <CardStat label="Min price" value={fmt(p.min_selling_price_usd, 'currency')} />
                      )}
                      {p.gross_profit_margin != null && (
                        <CardStat label="Margin" value={fmt(p.gross_profit_margin, 'pct')} />
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
      {active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
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

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-400 mb-0.5">{label}</p>
      <p className="font-medium text-slate-800 truncate">{value}</p>
    </div>
  )
}

function TableIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="14" height="14" rx="1" />
      <line x1="1" y1="5" x2="15" y2="5" />
      <line x1="1" y1="9" x2="15" y2="9" />
      <line x1="1" y1="13" x2="15" y2="13" />
      <line x1="5" y1="1" x2="5" y2="15" />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  )
}
