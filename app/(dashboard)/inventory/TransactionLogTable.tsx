'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface Transaction {
  transaction_id: string
  transaction_ref: string | null
  date_received: string | null
  date_shipped: string | null
  item_type: string
  movement_type: string
  from_location: string | null
  to_destination: string | null
  qty_change: number
  carrier: string | null
  delivery_status: string | null
  tracking_dhl: string | null
  tracking_fedex: string | null
  tracking_usps: string | null
  tracking_ups: string | null
  note: string | null
  created_at: string
  sku: { sku_name: string; name_external_eng: string | null } | null
  warehouse: { name: string; short_code: string } | null
}

const MOVEMENT_LABELS: Record<string, { label: string; color: string }> = {
  inbound_supplier_jp: { label: 'Inbound (Supplier → JP)', color: 'bg-green-50 text-green-700' },
  transfer_jp_us_out: { label: 'Transfer (JP → US) Out', color: 'bg-blue-50 text-blue-700' },
  transfer_jp_us_in: { label: 'Transfer (JP → US) In', color: 'bg-blue-50 text-blue-700' },
  direct_jp_us_customer: { label: 'Direct (JP → US Customer)', color: 'bg-orange-50 text-orange-700' },
  direct_jp_intl_customer: { label: 'Direct (JP → Intl Customer)', color: 'bg-orange-50 text-orange-700' },
  us_local_customer: { label: 'US Local → Customer', color: 'bg-purple-50 text-purple-700' },
  personal_use: { label: 'Personal Use', color: 'bg-slate-100 text-slate-600' },
  adjustment: { label: 'Manual Adjustment', color: 'bg-red-50 text-red-600' },
}

const LIMIT = 50

export default function TransactionLogTable() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [movementFilter, setMovementFilter] = useState('')
  const [carrierFilter, setCarrierFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: page.toString(),
      limit: LIMIT.toString(),
    })
    if (movementFilter) params.set('movement_type', movementFilter)
    if (carrierFilter) params.set('carrier', carrierFilter)
    if (fromDate) params.set('from_date', fromDate)
    if (toDate) params.set('to_date', toDate)

    const res = await fetch(`/api/inventory/transactions?${params}`)
    if (res.ok) {
      const json = await res.json()
      setTransactions(json.data)
      setTotal(json.total)
    }
    setLoading(false)
  }, [page, movementFilter, carrierFilter, fromDate, toDate])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data fetch pattern
    fetchTransactions()
  }, [fetchTransactions])

  // Client-side search filter on fetched data
  const filtered = search
    ? transactions.filter(t => {
        const q = search.toLowerCase()
        return [t.transaction_ref, t.sku?.sku_name, t.from_location, t.to_destination]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      })
    : transactions

  const totalPages = Math.ceil(total / LIMIT)

  function formatDate(t: Transaction) {
    const d = t.date_shipped || t.date_received
    if (!d) return '—'
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  function getTracking(t: Transaction) {
    if (t.tracking_dhl) return { number: t.tracking_dhl, carrier: 'DHL' }
    if (t.tracking_fedex) return { number: t.tracking_fedex, carrier: 'FedEx' }
    if (t.tracking_usps) return { number: t.tracking_usps, carrier: 'USPS' }
    if (t.tracking_ups) return { number: t.tracking_ups, carrier: 'UPS' }
    return null
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-200 shrink-0 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search ref, SKU, location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <select
          value={movementFilter}
          onChange={e => { setMovementFilter(e.target.value); setPage(1) }}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600"
        >
          <option value="">All Movements</option>
          {Object.entries(MOVEMENT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <select
          value={carrierFilter}
          onChange={e => { setCarrierFilter(e.target.value); setPage(1) }}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600"
        >
          <option value="">All Carriers</option>
          {['DHL', 'FedEx', 'USPS', 'UPS'].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <input
          type="date"
          value={fromDate}
          onChange={e => { setFromDate(e.target.value); setPage(1) }}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600"
          placeholder="From"
        />
        <input
          type="date"
          value={toDate}
          onChange={e => { setToDate(e.target.value); setPage(1) }}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600"
          placeholder="To"
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
            Loading...
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Ref</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Movement</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">From</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">To</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">SKU</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Qty</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Carrier</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Tracking</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400 text-sm">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                filtered.map(t => {
                  const movement = MOVEMENT_LABELS[t.movement_type] || { label: t.movement_type, color: 'bg-slate-50 text-slate-600' }
                  const tracking = getTracking(t)

                  return (
                    <tr key={t.transaction_id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatDate(t)}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{t.transaction_ref || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${movement.color}`}>
                          {movement.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{t.from_location || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600">{t.to_destination || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-700">{t.sku?.sku_name || '—'}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${
                        t.qty_change > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {t.qty_change > 0 ? `+${t.qty_change}` : t.qty_change}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{t.carrier || '—'}</td>
                      <td className="px-4 py-2.5 text-center">
                        {t.delivery_status === 'delivered' && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-50 text-green-600">Delivered</span>
                        )}
                        {t.delivery_status === 'in_transit' && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-50 text-amber-600">In Transit</span>
                        )}
                        {(!t.delivery_status || t.delivery_status === 'pending') && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-500">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">
                        {tracking ? `${tracking.carrier}: ${tracking.number}` : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 shrink-0">
          <p className="text-xs text-slate-500">
            Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 text-xs text-slate-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
