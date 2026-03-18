'use client'

import Link from 'next/link'
import type { Supplier, SupplierPurchaseOrder, SupplierProduct } from '@/types/database'
import { SUPPLIER_BUSINESS_TYPE_LABELS } from '@/types/database'
import { SUPPLIER_BUSINESS_TYPE_COLORS } from '@/lib/constants'

interface OrderWithItems extends SupplierPurchaseOrder {
  items: { quantity_kg: number; price_per_kg_jpy: number; subtotal_jpy: number | null }[]
}

interface LinkedProduct extends SupplierProduct {
  product: { product_id: string; customer_facing_product_name: string } | null
}

interface ActiveSuppliersGridProps {
  suppliers: Supplier[]
  orders: OrderWithItems[]
  linkedProducts: LinkedProduct[]
  lastContact: Record<string, string>
}

export default function ActiveSuppliersGrid({ suppliers, orders, linkedProducts, lastContact }: ActiveSuppliersGridProps) {
  const ordersBySupplier: Record<string, OrderWithItems[]> = {}
  for (const o of orders) {
    if (!ordersBySupplier[o.supplier_id]) ordersBySupplier[o.supplier_id] = []
    ordersBySupplier[o.supplier_id].push(o)
  }

  const productsBySupplier: Record<string, LinkedProduct[]> = {}
  for (const lp of linkedProducts) {
    if (!productsBySupplier[lp.supplier_id]) productsBySupplier[lp.supplier_id] = []
    productsBySupplier[lp.supplier_id].push(lp)
  }

  const formatCurrency = (amount: number) => `¥${Math.round(amount).toLocaleString()}`

  const relativeDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    const now = new Date()
    const days = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (days === 0) return '今日'
    if (days === 1) return '昨日'
    if (days < 7) return `${days}日前`
    if (days < 30) return `${Math.floor(days / 7)}週間前`
    return d.toLocaleDateString('ja-JP')
  }

  const renderStars = (rating: number | null) => {
    if (!rating) return <span className="text-slate-300">—</span>
    return (
      <span className="tracking-tight">
        <span className="text-amber-400">{'★'.repeat(rating)}</span>
        <span className="text-slate-200">{'★'.repeat(5 - rating)}</span>
      </span>
    )
  }

  if (suppliers.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-slate-400">No active suppliers yet. Convert suppliers from the pipeline when deals are established.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      {/* Sticky header */}
      <div className="flex items-center px-6 py-2 border-b border-slate-200 bg-white sticky top-0 z-10 text-xs text-slate-400 font-medium min-w-[760px]">
        <div className="flex-1 min-w-0">Supplier</div>
        <div className="w-28 shrink-0">Type</div>
        <div className="w-20 shrink-0">Orders</div>
        <div className="w-32 shrink-0">Total Spend</div>
        <div className="w-28 shrink-0">Quality</div>
        <div className="w-36 shrink-0">Last Contact</div>
      </div>

      {/* Rows */}
      <div className="min-w-[760px]">
        {suppliers.map((supplier) => {
          const supplierOrders = ordersBySupplier[supplier.supplier_id] ?? []
          const totalSpend = supplierOrders.reduce((sum, o) => sum + (o.total_amount_jpy ?? 0), 0)
          const ratedOrders = supplierOrders.filter((o) => o.quality_rating)
          const avgQuality = ratedOrders.length > 0
            ? ratedOrders.reduce((sum, o) => sum + (o.quality_rating ?? 0), 0) / ratedOrders.length
            : null
          const qualityRating = avgQuality ? Math.round(avgQuality) : supplier.quality_rating
          const lastContactDate = lastContact[supplier.supplier_id] ?? supplier.last_contacted_at

          const initials = supplier.supplier_name.charAt(0).toUpperCase()

          return (
            <Link
              key={supplier.supplier_id}
              href={`/active-suppliers/${supplier.supplier_id}`}
              className="flex items-center px-6 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors duration-150 cursor-pointer last:border-b-0"
            >
              {/* Avatar + name */}
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                  <span className="text-slate-500 text-sm font-semibold">{initials}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{supplier.supplier_name}</p>
                  {supplier.prefecture && (
                    <p className="text-xs text-slate-400 truncate">{supplier.prefecture}</p>
                  )}
                </div>
              </div>

              {/* Business type */}
              <div className="w-28 shrink-0">
                {supplier.business_type ? (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${SUPPLIER_BUSINESS_TYPE_COLORS[supplier.business_type]}`}>
                    {SUPPLIER_BUSINESS_TYPE_LABELS[supplier.business_type]}
                  </span>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </div>

              {/* Order count */}
              <div className="w-20 shrink-0 text-sm text-slate-600">
                {supplierOrders.length > 0 ? `${supplierOrders.length}回` : <span className="text-slate-300">—</span>}
              </div>

              {/* Total spend */}
              <div className="w-32 shrink-0 text-sm text-slate-600">
                {totalSpend > 0 ? formatCurrency(totalSpend) : <span className="text-slate-300">—</span>}
              </div>

              {/* Quality */}
              <div className="w-28 shrink-0">
                {renderStars(qualityRating ?? null)}
              </div>

              {/* Last contact */}
              <div className="w-36 shrink-0 text-xs text-slate-400">
                {relativeDate(lastContactDate ?? null)}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
