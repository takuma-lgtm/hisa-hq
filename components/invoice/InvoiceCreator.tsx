'use client'

import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import type { CrmSetting, PaymentMethod, InvoiceLineItem, InvoiceWithDetails } from '@/types/database'
import { getAllPaymentMethods } from '@/lib/payment-recommendation'
import { getWiseBankDetails } from '@/lib/wise-payments'
import { getZelleEmail } from '@/lib/zelle-payments'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CustomerInfo {
  customer_id: string
  cafe_name: string | null
  country: string | null
  phone: string | null
  email: string | null
  instagram_handle: string | null
  address: string | null
  contact_person: string | null
  qualified_volume_kg: number | null
}

export type PaymentTerms = 'full' | '50_50' | 'custom'

interface ExtraLineItem {
  name: string
  amount: number
}

interface Props {
  customer: CustomerInfo
  settings: CrmSetting[]
  defaultLineItems: InvoiceLineItem[]
  defaultCurrency: string
  onCreated: (inv: InvoiceWithDetails) => void
  opportunityId?: string
  createRecurringOrder?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const US_VALUES = new Set(['United States', 'US', 'USA', 'us', 'usa'])
const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', GBP: '£', EUR: '€' }

// ---------------------------------------------------------------------------
// InvoiceCreator
// ---------------------------------------------------------------------------

export default function InvoiceCreator({
  customer, settings, defaultLineItems, defaultCurrency, onCreated,
  opportunityId, createRecurringOrder,
}: Props) {
  const [currency, setCurrency] = useState(defaultCurrency)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  })
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([])
  const [extraItems, setExtraItems] = useState<ExtraLineItem[]>([])
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>('full')
  const [splitPct, setSplitPct] = useState(50)
  const [customerPaysTariffs, setCustomerPaysTariffs] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Derive payment methods
  const methods = getAllPaymentMethods(customer.country, currency, lineItems.reduce((s, i) => s + i.subtotal, 0))
  const wiseBankDetails = getWiseBankDetails(currency, settings)
  const zelleEmail = getZelleEmail(settings)

  const availableMethods = methods.filter((m) => {
    if (m.method === 'wise_transfer' && !wiseBankDetails) return false
    if (m.method === 'zelle' && !zelleEmail) return false
    return true
  })

  // Auto-select recommended method
  useEffect(() => {
    if (!selectedMethod && availableMethods.length > 0) {
      const rec = availableMethods.find((m) => m.recommended)
      setSelectedMethod(rec?.method ?? availableMethods[0].method)
    }
  }, [availableMethods, selectedMethod])

  // Auto-fill line items from defaults
  useEffect(() => {
    if (defaultLineItems.length > 0 && lineItems.length === 0) {
      setLineItems([...defaultLineItems])
    }
  }, [defaultLineItems, lineItems.length])

  function updateLineItem(idx: number, field: 'qty_kg' | 'price_per_kg', value: number) {
    setLineItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      updated.subtotal = updated.qty_kg * updated.price_per_kg
      return updated
    }))
  }

  function addExtraItem() {
    setExtraItems((prev) => [...prev, { name: '', amount: 0 }])
  }

  function updateExtraItem(idx: number, field: 'name' | 'amount', value: string | number) {
    setExtraItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item
      return { ...item, [field]: value }
    }))
  }

  function removeExtraItem(idx: number) {
    setExtraItems((prev) => prev.filter((_, i) => i !== idx))
  }

  // Calculate totals
  const productTotal = lineItems.reduce((s, i) => s + i.subtotal, 0)
  const tariffItems = extraItems.filter((i) => i.name.toLowerCase().includes('tariff'))
  const nonTariffExtras = extraItems.filter((i) => !i.name.toLowerCase().includes('tariff'))
  const tariffTotal = tariffItems.reduce((s, i) => s + i.amount, 0)
  const extrasTotal = nonTariffExtras.reduce((s, i) => s + i.amount, 0)
  const invoiceTotal = productTotal + extrasTotal + (customerPaysTariffs ? 0 : tariffTotal)
  const sym = CURRENCY_SYMBOLS[currency] ?? '$'
  const currentMethodInfo = availableMethods.find((m) => m.method === selectedMethod)

  // Split amounts
  const depositAmount = paymentTerms === 'full' ? invoiceTotal : Math.round(invoiceTotal * splitPct) / 100
  const balanceAmount = invoiceTotal - depositAmount

  async function handleCreate() {
    if (!selectedMethod || invoiceTotal <= 0) return
    setCreating(true)
    setError(null)

    try {
      // Combine product line items with extras for the invoice
      const allLineItems: InvoiceLineItem[] = [
        ...lineItems,
        ...nonTariffExtras.filter((e) => e.amount > 0).map((e) => ({
          product_name: e.name || 'Additional charge',
          qty_kg: 1,
          price_per_kg: e.amount,
          subtotal: e.amount,
        })),
        ...(customerPaysTariffs ? [] : tariffItems.filter((e) => e.amount > 0).map((e) => ({
          product_name: e.name || 'Tariff',
          qty_kg: 1,
          price_per_kg: e.amount,
          subtotal: e.amount,
        }))),
      ]

      const tariffNote = customerPaysTariffs && tariffTotal > 0
        ? `\nNote: Tariffs (${sym}${tariffTotal.toFixed(2)}) to be paid separately by customer.`
        : ''
      const invoiceNotes = (notes + tariffNote).trim() || null

      if (paymentTerms === 'full') {
        // Single invoice
        const res = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            opportunity_id: opportunityId || null,
            customer_id: customer.customer_id,
            payment_method: selectedMethod,
            currency,
            line_items: allLineItems,
            total_amount: invoiceTotal,
            due_date: dueDate,
            notes: invoiceNotes,
            create_recurring_order: createRecurringOrder ?? false,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to create invoice')
        }
        const invoice = await res.json()
        onCreated(invoice)
      } else {
        // Split payment: create 2 invoices with shared payment_group_id
        const groupId = crypto.randomUUID()
        const depositPctLabel = paymentTerms === '50_50' ? 50 : splitPct

        // Invoice 1: Deposit
        const res1 = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            opportunity_id: opportunityId || null,
            customer_id: customer.customer_id,
            payment_method: selectedMethod,
            currency,
            line_items: allLineItems,
            total_amount: depositAmount,
            due_date: dueDate,
            notes: invoiceNotes,
            payment_split_label: `Deposit (${depositPctLabel}%)`,
            payment_group_id: groupId,
            create_recurring_order: createRecurringOrder ?? false,
          }),
        })
        if (!res1.ok) {
          const data = await res1.json()
          throw new Error(data.error || 'Failed to create deposit invoice')
        }
        const depositInvoice = await res1.json()

        // Invoice 2: Balance (due 30 days after deposit)
        const balanceDueDate = new Date(dueDate)
        balanceDueDate.setDate(balanceDueDate.getDate() + 30)

        const res2 = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            opportunity_id: opportunityId || null,
            customer_id: customer.customer_id,
            payment_method: selectedMethod,
            currency,
            line_items: allLineItems,
            total_amount: balanceAmount,
            due_date: balanceDueDate.toISOString().split('T')[0],
            notes: invoiceNotes,
            payment_split_label: `Balance (${100 - depositPctLabel}%)`,
            payment_group_id: groupId,
          }),
        })
        if (!res2.ok) {
          const data = await res2.json()
          throw new Error(data.error || 'Failed to create balance invoice')
        }

        // Return the deposit invoice to the caller
        onCreated(depositInvoice)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-3">
      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Create Invoice</h3>

      {/* Payment terms */}
      <div className="space-y-1">
        <p className="text-xs text-slate-500">Payment Terms</p>
        <div className="flex gap-1">
          {([
            { value: 'full', label: 'Full Payment' },
            { value: '50_50', label: '50/50 Split' },
            { value: 'custom', label: 'Custom Split' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setPaymentTerms(opt.value)
                if (opt.value === '50_50') setSplitPct(50)
              }}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                paymentTerms === opt.value
                  ? 'bg-blue-50 border-blue-300 text-blue-800 font-medium'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {paymentTerms === 'custom' && (
          <div className="flex items-center gap-2 mt-1">
            <label className="text-xs text-slate-500">Deposit %</label>
            <input
              type="number"
              value={splitPct}
              onChange={(e) => setSplitPct(Math.max(1, Math.min(99, parseInt(e.target.value) || 50)))}
              className="w-16 text-xs border border-slate-200 rounded px-2 py-1 text-right"
              min={1} max={99}
            />
            <span className="text-xs text-slate-400">%</span>
          </div>
        )}
      </div>

      {/* Payment method tabs */}
      <div className="flex flex-wrap gap-1">
        {availableMethods.map((m) => (
          <button
            key={m.method}
            onClick={() => setSelectedMethod(m.method)}
            className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
              selectedMethod === m.method
                ? 'bg-green-50 border-green-300 text-green-800 font-medium'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {m.label}
            {m.recommended && <span className="ml-1 text-[10px]">*</span>}
          </button>
        ))}
      </div>

      {currentMethodInfo && (
        <div className="text-[11px] text-slate-400">
          {currentMethodInfo.recommended && <span className="text-green-600 font-medium">Recommended. </span>}
          Fee: {currentMethodInfo.feeEstimate}
          {currentMethodInfo.autoConfirmed ? ' — auto-confirmed' : ' — manual confirmation'}
        </div>
      )}

      {/* Currency */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500 w-16">Currency</label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="text-xs border border-slate-200 rounded px-2 py-1"
        >
          <option value="USD">USD</option>
          <option value="GBP">GBP</option>
          <option value="EUR">EUR</option>
        </select>
      </div>

      {/* Product line items */}
      <div className="space-y-1.5">
        <p className="text-xs text-slate-500">Products</p>
        {lineItems.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-xs">
            <span className="flex-1 truncate text-slate-700">{item.product_name}</span>
            <input
              type="number"
              value={item.qty_kg}
              onChange={(e) => updateLineItem(idx, 'qty_kg', parseFloat(e.target.value) || 0)}
              className="w-14 border border-slate-200 rounded px-1.5 py-0.5 text-right"
              min={0}
            />
            <span className="text-slate-400">kg ×</span>
            <span className="text-slate-400">{sym}</span>
            <input
              type="number"
              value={item.price_per_kg}
              onChange={(e) => updateLineItem(idx, 'price_per_kg', parseFloat(e.target.value) || 0)}
              className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-right"
              step="0.01"
              min={0}
            />
            <span className="text-slate-600 w-20 text-right font-medium">= {sym}{item.subtotal.toFixed(2)}</span>
          </div>
        ))}

        {/* Extra line items (shipping, tariffs, etc.) */}
        {extraItems.map((item, idx) => (
          <div key={`extra-${idx}`} className="flex items-center gap-1.5 text-xs">
            <input
              type="text"
              value={item.name}
              onChange={(e) => updateExtraItem(idx, 'name', e.target.value)}
              placeholder="Shipping, Tariff, etc."
              className="flex-1 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700"
            />
            <span className="text-slate-400">{sym}</span>
            <input
              type="number"
              value={item.amount}
              onChange={(e) => updateExtraItem(idx, 'amount', parseFloat(e.target.value) || 0)}
              className="w-20 border border-slate-200 rounded px-1.5 py-0.5 text-right"
              step="0.01"
              min={0}
            />
            <button onClick={() => removeExtraItem(idx)} className="text-slate-400 hover:text-red-500">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        <button
          onClick={addExtraItem}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <Plus className="w-3 h-3" /> Add shipping, tariff, or other charge
        </button>

        {/* Customer pays tariffs toggle */}
        {tariffItems.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-slate-600 mt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={customerPaysTariffs}
              onChange={(e) => setCustomerPaysTariffs(e.target.checked)}
              className="rounded border-slate-300"
            />
            Customer pays tariffs separately ({sym}{tariffTotal.toFixed(2)})
          </label>
        )}

        {/* Totals */}
        <div className="pt-1 border-t border-slate-100 space-y-0.5">
          <div className="flex justify-between text-xs font-semibold text-slate-800">
            <span>Total</span>
            <span>{sym}{invoiceTotal.toFixed(2)} {currency}</span>
          </div>
          {customerPaysTariffs && tariffTotal > 0 && (
            <div className="flex justify-between text-[11px] text-amber-600">
              <span>+ Tariffs (customer pays separately)</span>
              <span>{sym}{tariffTotal.toFixed(2)}</span>
            </div>
          )}
          {paymentTerms !== 'full' && (
            <>
              <div className="flex justify-between text-[11px] text-blue-600">
                <span>This invoice (deposit {paymentTerms === '50_50' ? '50' : splitPct}%)</span>
                <span>{sym}{depositAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Balance invoice ({paymentTerms === '50_50' ? '50' : (100 - splitPct)}%)</span>
                <span>{sym}{balanceAmount.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Due date */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500 w-16">Due Date</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="text-xs border border-slate-200 rounded px-2 py-1"
        />
      </div>

      {/* Notes */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional notes..."
        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 resize-none"
        rows={2}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        onClick={handleCreate}
        disabled={creating || invoiceTotal <= 0 || !selectedMethod}
        className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-lg transition-colors"
      >
        {creating
          ? 'Creating Invoice...'
          : paymentTerms === 'full'
            ? 'Create Invoice'
            : 'Create Split Invoices'}
      </button>
    </div>
  )
}
