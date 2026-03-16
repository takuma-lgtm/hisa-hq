'use client'

import { useState } from 'react'
import { Copy, Check, ExternalLink } from 'lucide-react'
import type { CrmSetting, InvoiceLineItem, InvoiceWithDetails, OpportunityStage } from '@/types/database'
import { getWiseBankDetails, generateWiseInvoiceMessage } from '@/lib/wise-payments'
import { generateZelleMessage, getZelleEmail } from '@/lib/zelle-payments'
import type { CustomerInfo } from './InvoiceCreator'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  invoice: InvoiceWithDetails
  customer: CustomerInfo
  settings: CrmSetting[]
  canEdit: boolean
  onUpdated: (inv: InvoiceWithDetails) => void
  onStageChanged?: (oppId: string, newStage: OpportunityStage) => void
  oppId?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', GBP: '£', EUR: '€' }

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const methodLabels: Record<string, string> = {
  stripe_ach: 'Bank Transfer (ACH)',
  stripe_card: 'Card',
  wise_transfer: 'Bank Transfer (Wise)',
  zelle: 'Zelle',
}

// ---------------------------------------------------------------------------
// InvoiceCard
// ---------------------------------------------------------------------------

export default function InvoiceCard({
  invoice, customer, settings, canEdit, onUpdated, onStageChanged, oppId,
}: Props) {
  const [copied, setCopied] = useState(false)
  const [markingPaid, setMarkingPaid] = useState(false)
  const [confirmPaid, setConfirmPaid] = useState(false)
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().split('T')[0])

  const sym = CURRENCY_SYMBOLS[invoice.currency ?? 'USD'] ?? '$'
  const isPaid = invoice.payment_status === 'paid'
  const isFailed = invoice.payment_status === 'failed'

  const statusBadge = isPaid
    ? 'bg-green-50 text-green-700'
    : isFailed
      ? 'bg-red-50 text-red-700'
      : 'bg-amber-50 text-amber-700'

  const statusText = isPaid ? 'Paid' : isFailed ? 'Failed' : 'Pending'

  function getMessage(): string {
    if (invoice.payment_method === 'wise_transfer' && invoice.wise_bank_details) {
      const bd = invoice.wise_bank_details as Record<string, string>
      const bankDetails = {
        currency: invoice.currency ?? 'USD',
        accountHolder: bd.accountHolder ?? '',
        bankName: bd.bankName ?? '',
        routingNumber: bd.routingNumber,
        accountNumber: bd.accountNumber,
        sortCode: bd.sortCode,
        iban: bd.iban,
        bic: bd.bic,
      }
      return generateWiseInvoiceMessage(
        {
          invoice_number: invoice.invoice_number ?? '',
          due_date: invoice.due_date,
          amount: invoice.amount,
          currency: invoice.currency ?? 'USD',
          line_items_detail: invoice.line_items_detail as InvoiceLineItem[] | null,
          created_at: invoice.created_at,
        },
        bankDetails,
        { cafe_name: customer.cafe_name, address: customer.address },
      )
    }

    if (invoice.payment_method === 'zelle') {
      return generateZelleMessage(
        {
          invoice_number: invoice.invoice_number ?? '',
          amount: invoice.amount,
          line_items_detail: invoice.line_items_detail as InvoiceLineItem[] | null,
        },
        invoice.zelle_email ?? getZelleEmail(settings),
      )
    }

    const splitLabel = invoice.payment_split_label ? ` (${invoice.payment_split_label})` : ''
    if (invoice.stripe_payment_link) {
      return `Invoice: ${invoice.invoice_number}${splitLabel}\nAmount: ${sym}${invoice.amount.toFixed(2)} ${invoice.currency}\n\nPay here:\n${invoice.stripe_payment_link}\n\nThank you!\nHisa Matcha`
    }

    return `Invoice: ${invoice.invoice_number}${splitLabel}\nAmount: ${sym}${invoice.amount.toFixed(2)} ${invoice.currency}`
  }

  function handleCopy() {
    navigator.clipboard.writeText(getMessage())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSend(via: 'whatsapp' | 'instagram' | 'email') {
    const msg = getMessage()
    const encoded = encodeURIComponent(msg)

    if (via === 'whatsapp' && customer.phone) {
      const phone = customer.phone.replace(/[^+\d]/g, '')
      window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank')
    } else if (via === 'instagram' && customer.instagram_handle) {
      navigator.clipboard.writeText(msg)
      const handle = customer.instagram_handle.replace('@', '')
      window.open(`https://ig.me/m/${handle}`, '_blank')
    } else if (via === 'email' && customer.email) {
      const subject = encodeURIComponent(`Invoice ${invoice.invoice_number} - Hisa Matcha`)
      window.open(`mailto:${customer.email}?subject=${subject}&body=${encoded}`, '_blank')
    }

    try {
      await fetch(`/api/invoices/${invoice.invoice_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sent_at: new Date().toISOString(), sent_via: via }),
      })
    } catch {}
  }

  async function handleMarkPaid() {
    setMarkingPaid(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.invoice_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_status: 'paid',
          paid_at: new Date(paidDate + 'T00:00:00').toISOString(),
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        onUpdated(updated)
        if (oppId) onStageChanged?.(oppId, 'deal_won')
        setConfirmPaid(false)
      }
    } finally {
      setMarkingPaid(false)
    }
  }

  const isManualConfirm = invoice.payment_method === 'wise_transfer' || invoice.payment_method === 'zelle'

  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-slate-700">
          Invoice {invoice.invoice_number}
          {invoice.payment_split_label && (
            <span className="ml-1.5 text-[11px] font-normal text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
              {invoice.payment_split_label}
            </span>
          )}
        </h3>
        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${statusBadge}`}>
          {statusText}
        </span>
      </div>

      {/* Details */}
      <div className="text-xs text-slate-500 space-y-0.5">
        <div className="flex justify-between">
          <span>Method</span>
          <span className="text-slate-700">{methodLabels[invoice.payment_method ?? ''] ?? invoice.payment_method}</span>
        </div>
        <div className="flex justify-between">
          <span>Amount</span>
          <span className="text-slate-700 font-medium">{sym}{invoice.amount.toFixed(2)} {invoice.currency}</span>
        </div>
        {invoice.due_date && (
          <div className="flex justify-between">
            <span>Due</span>
            <span className="text-slate-700">{formatDate(invoice.due_date)}</span>
          </div>
        )}
        {invoice.paid_at && (
          <div className="flex justify-between">
            <span>Paid</span>
            <span className="text-green-700">{formatDate(invoice.paid_at)}</span>
          </div>
        )}
        {invoice.sent_at && (
          <div className="flex justify-between">
            <span>Sent</span>
            <span className="text-slate-700">{formatDate(invoice.sent_at)} via {invoice.sent_via}</span>
          </div>
        )}
      </div>

      {/* Stripe payment link */}
      {invoice.stripe_payment_link && !isPaid && (
        <div className="space-y-1">
          <p className="text-[11px] text-slate-400">Payment Link</p>
          <a
            href={invoice.stripe_payment_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1 break-all"
          >
            <ExternalLink className="w-3 h-3 shrink-0" />
            {invoice.stripe_payment_link.slice(0, 50)}...
          </a>
        </div>
      )}

      {/* Wise bank details */}
      {invoice.payment_method === 'wise_transfer' && invoice.wise_bank_details && !isPaid && (
        <div className="bg-slate-50 rounded p-2 text-xs text-slate-600 space-y-0.5">
          <p className="font-medium text-slate-700">Transfer to:</p>
          {Object.entries(invoice.wise_bank_details as Record<string, string>)
            .filter(([k]) => k !== 'currency')
            .map(([key, val]) => val ? (
              <div key={key} className="flex justify-between">
                <span className="text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span>{val}</span>
              </div>
            ) : null)}
          <p className="text-[11px] text-slate-400 mt-1">Reference: {invoice.invoice_number}</p>
        </div>
      )}

      {/* Zelle info */}
      {invoice.payment_method === 'zelle' && !isPaid && (
        <div className="bg-slate-50 rounded p-2 text-xs text-slate-600">
          <p>Send via Zelle to: <span className="font-medium text-slate-700">{invoice.zelle_email}</span></p>
          <p className="text-[11px] text-slate-400 mt-1">Reference: {invoice.invoice_number}</p>
        </div>
      )}

      {/* Auto-confirm note for Stripe */}
      {(invoice.payment_method === 'stripe_ach' || invoice.payment_method === 'stripe_card') && !isPaid && (
        <p className="text-[11px] text-green-600">Payment will be confirmed automatically when the customer pays.</p>
      )}

      {/* Actions */}
      {!isPaid && (
        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800 border border-slate-200 rounded px-2 py-1"
            >
              {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
            {customer.phone && (
              <button
                onClick={() => handleSend('whatsapp')}
                className="text-xs text-slate-600 hover:text-slate-800 border border-slate-200 rounded px-2 py-1"
              >
                WhatsApp
              </button>
            )}
            {customer.instagram_handle && (
              <button
                onClick={() => handleSend('instagram')}
                className="text-xs text-slate-600 hover:text-slate-800 border border-slate-200 rounded px-2 py-1"
              >
                IG
              </button>
            )}
            {customer.email && (
              <button
                onClick={() => handleSend('email')}
                className="text-xs text-slate-600 hover:text-slate-800 border border-slate-200 rounded px-2 py-1"
              >
                Email
              </button>
            )}
          </div>

          {/* Mark as Paid (manual methods only) */}
          {isManualConfirm && canEdit && !confirmPaid && (
            <button
              onClick={() => setConfirmPaid(true)}
              className="w-full bg-green-700 hover:bg-green-800 text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
            >
              Mark as Paid
            </button>
          )}

          {isManualConfirm && confirmPaid && (
            <div className="border border-green-200 rounded-lg p-2 space-y-2 bg-green-50">
              <p className="text-xs text-slate-700">Confirm payment of {sym}{invoice.amount.toFixed(2)} received?</p>
              <input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                className="text-xs border border-slate-200 rounded px-2 py-1 w-full"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleMarkPaid}
                  disabled={markingPaid}
                  className="flex-1 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-xs font-medium py-1.5 rounded transition-colors"
                >
                  {markingPaid ? 'Confirming...' : 'Confirm Paid'}
                </button>
                <button
                  onClick={() => setConfirmPaid(false)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs py-1.5 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
