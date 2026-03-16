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
  // Group orders by supplier
  const ordersBySupplier: Record<string, OrderWithItems[]> = {}
  for (const o of orders) {
    if (!ordersBySupplier[o.supplier_id]) ordersBySupplier[o.supplier_id] = []
    ordersBySupplier[o.supplier_id].push(o)
  }

  // Group products by supplier
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
      <span className="text-amber-500">
        {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
      </span>
    )
  }

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {suppliers.map((supplier) => {
        const supplierOrders = ordersBySupplier[supplier.supplier_id] ?? []
        const supplierProductsList = productsBySupplier[supplier.supplier_id] ?? []
        const totalSpend = supplierOrders.reduce((sum, o) => sum + (o.total_amount_jpy ?? 0), 0)
        const lastOrder = supplierOrders[0]
        const avgQuality = supplierOrders.length > 0
          ? supplierOrders.filter((o) => o.quality_rating).reduce((sum, o) => sum + (o.quality_rating ?? 0), 0) /
            (supplierOrders.filter((o) => o.quality_rating).length || 1)
          : null

        return (
          <Link
            key={supplier.supplier_id}
            href={`/active-suppliers/${supplier.supplier_id}`}
            className="bg-white border border-slate-200 rounded-xl p-5 hover:border-green-300 hover:shadow-sm transition-all block"
          >
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-sm font-bold shrink-0">
                {supplier.supplier_name[0]}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 truncate">{supplier.supplier_name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {supplier.prefecture && (
                    <span className="text-xs text-slate-500">{supplier.prefecture}</span>
                  )}
                  {supplier.business_type && (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${SUPPLIER_BUSINESS_TYPE_COLORS[supplier.business_type]}`}>
                      {SUPPLIER_BUSINESS_TYPE_LABELS[supplier.business_type]}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Products */}
            {supplierProductsList.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {supplierProductsList.slice(0, 3).map((lp) => (
                  <span key={lp.id} className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded">
                    {lp.product?.customer_facing_product_name ?? lp.product_name_jpn ?? '—'}
                  </span>
                ))}
                {supplierProductsList.length > 3 && (
                  <span className="text-[10px] text-slate-400">+{supplierProductsList.length - 3}</span>
                )}
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <span className="text-slate-400">合計仕入額</span>
                <p className="font-medium text-slate-900">{totalSpend > 0 ? formatCurrency(totalSpend) : '—'}</p>
              </div>
              <div>
                <span className="text-slate-400">発注回数</span>
                <p className="font-medium text-slate-900">{supplierOrders.length > 0 ? `${supplierOrders.length}回` : '—'}</p>
              </div>
              <div>
                <span className="text-slate-400">最終発注</span>
                <p className="font-medium text-slate-900">{relativeDate(lastOrder?.order_date ?? null)}</p>
              </div>
              <div>
                <span className="text-slate-400">品質評価</span>
                <p className="font-medium">{renderStars(avgQuality ? Math.round(avgQuality) : supplier.quality_rating)}</p>
              </div>
              <div>
                <span className="text-slate-400">最終連絡</span>
                <p className="font-medium text-slate-900">{relativeDate(lastContact[supplier.supplier_id] ?? supplier.last_contacted_at)}</p>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
