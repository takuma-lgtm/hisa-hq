'use client'

import { Phone, FileText, Package, BarChart2, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { formatDate } from '@/lib/utils'
import {
  CALL_TYPE_LABELS,
  CALL_OUTCOME_LABELS,
} from '@/lib/constants'
import ProposalMessage from './ProposalMessage'
import { createClient } from '@/lib/supabase/client'
import type {
  CallLogWithProfile,
  ProposalWithItems,
  SampleBatchWithItems,
  Quotation,
  Invoice,
  Customer,
  SampleFeedback,
} from '@/types/database'

interface Props {
  callLogs: CallLogWithProfile[]
  proposals: ProposalWithItems[]
  sampleBatches: SampleBatchWithItems[]
  quotations: Quotation[]
  invoices: Invoice[]
  customer: Pick<Customer, 'contact_person' | 'cafe_name'>
  onBatchFeedbackUpdate: (batchId: string, itemId: string, feedback: SampleFeedback) => void
}

type TimelineEntry =
  | { type: 'call'; data: CallLogWithProfile; date: string }
  | { type: 'proposal'; data: ProposalWithItems; date: string }
  | { type: 'sample'; data: SampleBatchWithItems; date: string }
  | { type: 'quote'; data: Quotation; date: string }
  | { type: 'invoice'; data: Invoice; date: string }

export default function TimelineView({
  callLogs,
  proposals,
  sampleBatches,
  quotations,
  invoices,
  customer,
  onBatchFeedbackUpdate,
}: Props) {
  const entries: TimelineEntry[] = [
    ...callLogs.map((d) => ({ type: 'call' as const, data: d, date: d.called_at })),
    ...proposals.map((d) => ({ type: 'proposal' as const, data: d, date: d.created_at })),
    ...sampleBatches.map((d) => ({ type: 'sample' as const, data: d, date: d.created_at })),
    ...quotations.map((d) => ({ type: 'quote' as const, data: d, date: d.created_at })),
    ...invoices.map((d) => ({ type: 'invoice' as const, data: d, date: d.created_at })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <MessageSquare className="w-8 h-8 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">No activity yet</p>
        <p className="text-xs text-gray-400 mt-1">Use the action panel to log calls, create proposals, and more.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, i) => {
        const key = `${entry.type}-${i}`
        if (entry.type === 'call') return <CallEntry key={key} log={entry.data} />
        if (entry.type === 'proposal') return <ProposalEntry key={key} proposal={entry.data} customer={customer} />
        if (entry.type === 'sample') return <SampleEntry key={key} batch={entry.data} onFeedbackUpdate={onBatchFeedbackUpdate} />
        if (entry.type === 'quote') return <QuoteEntry key={key} quote={entry.data} />
        if (entry.type === 'invoice') return <InvoiceEntry key={key} invoice={entry.data} />
        return null
      })}
    </div>
  )
}

// --- Entry components ---

function EntryCard({
  icon,
  iconBg,
  title,
  meta,
  children,
}: {
  icon: React.ReactNode
  iconBg: string
  title: string
  meta: string
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
          <p className="text-xs text-gray-500">{meta}</p>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
      </button>
      {open && children && <div className="px-4 pb-4 border-t border-gray-100">{children}</div>}
    </div>
  )
}

function CallEntry({ log }: { log: CallLogWithProfile }) {
  return (
    <EntryCard
      icon={<Phone className="w-3.5 h-3.5 text-blue-600" />}
      iconBg="bg-blue-50"
      title={`Call · ${CALL_TYPE_LABELS[log.call_type]}`}
      meta={`${formatDate(log.called_at)} · ${log.logged_by_profile.name} · ${CALL_OUTCOME_LABELS[log.outcome]}`}
    >
      {log.spoke_with_name && (
        <p className="text-xs text-gray-600 mt-3">
          Spoke with: <strong>{log.spoke_with_name}</strong>
          {log.spoke_with_role && ` (${log.spoke_with_role})`}
          {log.duration_minutes && ` · ${log.duration_minutes} min`}
        </p>
      )}
      {log.raw_summary && (
        <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{log.raw_summary}</p>
      )}
      {(log.ext_likes || log.ext_dislikes || log.ext_current_supplier || log.ext_why_switch) && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Market Intel {log.intel_applied && <span className="text-green-600 ml-1">· Applied</span>}
          </p>
          {log.ext_current_supplier && <Intel label="Supplier">{log.ext_current_supplier}</Intel>}
          {log.ext_current_price_per_kg && <Intel label="Current price">${log.ext_current_price_per_kg}/kg</Intel>}
          {log.ext_likes && <Intel label="Likes">{log.ext_likes}</Intel>}
          {log.ext_dislikes && <Intel label="Dislikes">{log.ext_dislikes}</Intel>}
          {log.ext_why_switch && <Intel label="Why switch">{log.ext_why_switch}</Intel>}
        </div>
      )}
    </EntryCard>
  )
}

function ProposalEntry({
  proposal,
  customer,
}: {
  proposal: ProposalWithItems
  customer: Pick<Customer, 'contact_person' | 'cafe_name'>
}) {
  return (
    <EntryCard
      icon={<FileText className="w-3.5 h-3.5 text-purple-600" />}
      iconBg="bg-purple-50"
      title={`Proposal · via ${proposal.sent_via.toUpperCase()}`}
      meta={`${formatDate(proposal.created_at)}${proposal.sent_at ? ` · Sent ${formatDate(proposal.sent_at)}` : ' · Draft'}`}
    >
      <div className="mt-3 space-y-1">
        {proposal.items.map((item) => (
          <div key={item.item_id} className="flex justify-between text-sm">
            <span className="text-gray-700">{item.product.customer_facing_product_name}</span>
            <span className="font-medium text-gray-900">
              ${item.price_per_kg}/{item.currency}
            </span>
          </div>
        ))}
      </div>
      {proposal.notes && (
        <p className="mt-2 text-xs text-gray-500 italic">{proposal.notes}</p>
      )}
      <div className="mt-3">
        <ProposalMessage proposal={proposal} contactPerson={customer.contact_person} />
      </div>
    </EntryCard>
  )
}

const FEEDBACK_COLORS: Record<string, string> = {
  liked: 'bg-green-100 text-green-800',
  neutral: 'bg-yellow-100 text-yellow-800',
  disliked: 'bg-red-100 text-red-800',
  pending: 'bg-gray-100 text-gray-600',
}

function SampleEntry({
  batch,
  onFeedbackUpdate,
}: {
  batch: SampleBatchWithItems
  onFeedbackUpdate: (batchId: string, itemId: string, feedback: SampleFeedback) => void
}) {
  const supabase = createClient()

  async function saveFeedback(itemId: string, feedback: SampleFeedback) {
    await supabase
      .from('sample_batch_items')
      .update({ feedback })
      .eq('item_id', itemId)
    onFeedbackUpdate(batch.batch_id, itemId, feedback)
  }

  return (
    <EntryCard
      icon={<Package className="w-3.5 h-3.5 text-amber-600" />}
      iconBg="bg-amber-50"
      title={`Sample Batch · ${batch.carrier ?? 'Carrier TBD'}`}
      meta={`Shipped ${batch.shipped_at ? formatDate(batch.shipped_at) : batch.date_shipped ?? 'TBD'} · ${batch.ship_from}`}
    >
      {batch.tracking_number && (
        <p className="text-xs text-gray-500 mt-3">
          Tracking: <span className="font-mono text-gray-700">{batch.tracking_number}</span>
        </p>
      )}
      {batch.delivered_at && (
        <p className="text-xs text-gray-500">Delivered: {formatDate(batch.delivered_at)}</p>
      )}
      <div className="mt-3 space-y-2">
        {batch.items.map((item) => (
          <div key={item.item_id} className="flex items-center justify-between gap-2">
            <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">
              {item.product_snapshot ?? item.product_id ?? 'Unknown product'}
              {item.qty_grams && <span className="text-xs text-gray-400 ml-1">({item.qty_grams}g)</span>}
            </span>
            <select
              value={item.feedback}
              onChange={(e) => saveFeedback(item.item_id, e.target.value as SampleFeedback)}
              className={`text-xs rounded-full px-2 py-0.5 border-0 font-medium cursor-pointer ${FEEDBACK_COLORS[item.feedback]}`}
            >
              <option value="pending">Pending</option>
              <option value="liked">Liked</option>
              <option value="neutral">Neutral</option>
              <option value="disliked">Disliked</option>
            </select>
          </div>
        ))}
      </div>
    </EntryCard>
  )
}

function QuoteEntry({ quote }: { quote: Quotation }) {
  const STATUS_COLOR: Record<string, string> = {
    draft: 'text-gray-500',
    sent: 'text-blue-600',
    accepted: 'text-green-600',
    rejected: 'text-red-600',
  }
  return (
    <EntryCard
      icon={<BarChart2 className="w-3.5 h-3.5 text-green-600" />}
      iconBg="bg-green-50"
      title={`Quote · $${quote.total_amount.toLocaleString()}`}
      meta={`${formatDate(quote.created_at)} · ${quote.payment_terms.replace('_', ' ')}`}
    >
      <p className={`text-sm font-medium mt-3 ${STATUS_COLOR[quote.status]}`}>
        Status: {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
      </p>
      {quote.shipping_terms && (
        <p className="text-xs text-gray-500 mt-1">Shipping: {quote.shipping_terms}</p>
      )}
    </EntryCard>
  )
}

function InvoiceEntry({ invoice }: { invoice: Invoice }) {
  return (
    <EntryCard
      icon={<BarChart2 className="w-3.5 h-3.5 text-sky-600" />}
      iconBg="bg-sky-50"
      title={`Invoice · $${invoice.amount.toLocaleString()}`}
      meta={`${formatDate(invoice.created_at)} · ${invoice.payment_status}`}
    >
      {invoice.stripe_payment_link && (
        <a
          href={invoice.stripe_payment_link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 underline mt-3 block"
        >
          Payment link ↗
        </a>
      )}
    </EntryCard>
  )
}

function Intel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-xs text-gray-700">
      <span className="font-medium text-gray-500">{label}: </span>{children}
    </p>
  )
}
