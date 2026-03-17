'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import type { CrmSetting, InvoiceLineItem, InvoiceWithDetails } from '@/types/database'
import InvoiceCreator from '@/components/invoice/InvoiceCreator'
import InvoiceCard from '@/components/invoice/InvoiceCard'
import type { CustomerInfo } from '@/components/invoice/InvoiceCreator'
import { formatCurrency, formatDate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecurringOrderRow {
  order_id: string
  customer_id: string
  total_amount: number | null
  created_at: string
  status: string
  line_items: unknown
  monthly_volume: number | null
  currency: string
}

interface ProductRow {
  product_id: string
  customer_facing_product_name: string | null
  selling_price_usd: number | null
  selling_price_gbp: number | null
  selling_price_eur: number | null
}

interface Props {
  customer: Record<string, unknown>
  orders: RecurringOrderRow[]
  invoices: InvoiceWithDetails[]
  settings: CrmSetting[]
  products: ProductRow[]
  canEdit: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const US_VALUES = new Set(['United States', 'US', 'USA', 'us', 'usa'])
const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', GBP: '£', EUR: '€' }

function defaultCurrency(country: string | null): string {
  if (!country) return 'USD'
  const c = country.trim()
  if (US_VALUES.has(c)) return 'USD'
  if (c === 'United Kingdom' || c === 'UK' || c === 'GB') return 'GBP'
  const euCountries = ['Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Austria', 'Ireland', 'Portugal', 'Greece', 'Finland']
  if (euCountries.includes(c)) return 'EUR'
  return 'USD'
}

// ---------------------------------------------------------------------------
// RecurringDetail
// ---------------------------------------------------------------------------

export default function RecurringDetail({ customer, orders, invoices: initialInvoices, settings, products, canEdit }: Props) {
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>(initialInvoices)
  const [showCreator, setShowCreator] = useState(false)
  const [showOrders, setShowOrders] = useState(false)

  const customerId = customer.customer_id as string
  const cafeName = customer.cafe_name as string
  const city = customer.city as string | null
  const country = customer.country as string | null
  const contactPerson = customer.contact_person as string | null
  const email = customer.email as string | null
  const phone = customer.phone as string | null
  const instagramHandle = customer.instagram_handle as string | null
  const monthlyUsage = customer.monthly_matcha_usage_kg as number | null
  const qualifiedVolume = customer.qualified_volume_kg as number | null

  const customerInfo: CustomerInfo = {
    customer_id: customerId,
    cafe_name: cafeName,
    country,
    phone: phone,
    email: email,
    instagram_handle: instagramHandle,
    address: customer.address as string | null,
    contact_person: contactPerson,
    qualified_volume_kg: qualifiedVolume,
  }

  const currency = defaultCurrency(country)
  const sym = CURRENCY_SYMBOLS[currency] ?? '$'

  // Build default line items from last order
  const lastOrder = orders[0]
  const defaultLineItems: InvoiceLineItem[] = []
  if (lastOrder?.line_items && Array.isArray(lastOrder.line_items)) {
    for (const item of lastOrder.line_items as Array<{ product_name?: string; name?: string; qty_kg?: number; price_per_kg?: number }>) {
      const name = item.product_name ?? item.name ?? 'Product'
      const qty = item.qty_kg ?? (monthlyUsage ?? qualifiedVolume ?? 5)
      const price = item.price_per_kg ?? 0
      defaultLineItems.push({
        product_name: name,
        qty_kg: qty,
        price_per_kg: price,
        subtotal: qty * price,
      })
    }
  }

  // Lifetime stats
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount ?? 0), 0)
  const paidInvoices = invoices.filter((i) => i.payment_status === 'paid')
  const pendingInvoices = invoices.filter((i) => i.payment_status === 'pending')

  const handleInvoiceCreated = useCallback((inv: InvoiceWithDetails) => {
    setInvoices((prev) => [inv, ...prev])
    setShowCreator(false)
  }, [])

  const handleInvoiceUpdated = useCallback((inv: InvoiceWithDetails) => {
    setInvoices((prev) => prev.map((i) => i.invoice_id === inv.invoice_id ? inv : i))
  }, [])

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/recurring" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="w-4 h-4" /> Back to Recurring Customers
      </Link>

      {/* Customer Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-green-800 text-xl font-semibold">{cafeName.charAt(0)}</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{cafeName}</h1>
              <p className="text-sm text-slate-500">{[city, country].filter(Boolean).join(', ')}</p>
              {contactPerson && <p className="text-sm text-slate-400 mt-0.5">{contactPerson}</p>}
            </div>
          </div>
          <div className="flex gap-2 text-xs">
            {email && (
              <a href={`mailto:${email}`} className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
                Email
              </a>
            )}
            {phone && (
              <a href={`https://wa.me/${phone.replace(/[^+\d]/g, '')}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
                WhatsApp
              </a>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-6 mt-6 pt-4 border-t border-slate-100">
          <div>
            <p className="text-xs text-slate-400">Monthly Volume</p>
            <p className="text-sm font-medium text-slate-800">{monthlyUsage ?? qualifiedVolume ?? '—'} kg</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Lifetime Revenue</p>
            <p className="text-sm font-medium text-slate-800">{totalRevenue > 0 ? formatCurrency(totalRevenue) : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Orders</p>
            <p className="text-sm font-medium text-slate-800">{orders.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Pending Invoices</p>
            <p className={`text-sm font-medium ${pendingInvoices.length > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
              {pendingInvoices.length}
            </p>
          </div>
        </div>
      </div>

      {/* New Invoice Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-800">Invoices</h2>
          {canEdit && !showCreator && (
            <button
              onClick={() => setShowCreator(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New Invoice
            </button>
          )}
        </div>

        {/* Invoice Creator */}
        {showCreator && (
          <div className="mb-4">
            <InvoiceCreator
              customer={customerInfo}
              settings={settings}
              defaultLineItems={defaultLineItems}
              defaultCurrency={currency}
              onCreated={handleInvoiceCreated}
              createRecurringOrder
            />
            <button
              onClick={() => setShowCreator(false)}
              className="mt-2 text-xs text-slate-400 hover:text-slate-600"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Invoice List */}
        {invoices.length > 0 ? (
          <div className="space-y-3">
            {invoices.map((inv) => (
              <InvoiceCard
                key={inv.invoice_id}
                invoice={inv}
                customer={customerInfo}
                settings={settings}
                canEdit={canEdit}
                onUpdated={handleInvoiceUpdated}
              />
            ))}
          </div>
        ) : !showCreator ? (
          <p className="text-sm text-slate-400 text-center py-8">No invoices yet. Click &quot;New Invoice&quot; to create one.</p>
        ) : null}
      </div>

      {/* Order History */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <button
          onClick={() => setShowOrders(!showOrders)}
          className="flex items-center justify-between w-full"
        >
          <h2 className="text-sm font-semibold text-slate-800">Order History ({orders.length})</h2>
          {showOrders ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showOrders && orders.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Products</th>
                  <th className="text-right py-2 font-medium">Amount</th>
                  <th className="text-right py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const items = Array.isArray(order.line_items) ? order.line_items as Array<{ product_name?: string; name?: string }> : []
                  const productNames = items.map((i) => i.product_name ?? i.name ?? '').filter(Boolean).join(', ')
                  const orderSym = CURRENCY_SYMBOLS[order.currency] ?? '$'

                  return (
                    <tr key={order.order_id} className="border-b border-slate-50">
                      <td className="py-2 text-slate-700">{formatDate(order.created_at)}</td>
                      <td className="py-2 text-slate-600 truncate max-w-[200px]">{productNames || '—'}</td>
                      <td className="py-2 text-right text-slate-700 font-medium">
                        {order.total_amount != null ? `${orderSym}${order.total_amount.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2 text-right">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                          order.status === 'paid' ? 'bg-green-50 text-green-700'
                            : order.status === 'pending' ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {showOrders && orders.length === 0 && (
          <p className="mt-4 text-sm text-slate-400 text-center py-4">No orders yet.</p>
        )}
      </div>
    </div>
  )
}
