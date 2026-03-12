'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type {
  OpportunityFull,
  CallLogWithProfile,
  ProposalWithItems,
  SampleBatchWithItems,
  Quotation,
  Invoice,
  Profile,
} from '@/types/database'
import QualificationPanel from '@/components/opportunity/QualificationPanel'
import HandoffSummaryCard from '@/components/opportunity/HandoffSummaryCard'
import TimelineView from '@/components/opportunity/TimelineView'
import ActionPanel from '@/components/opportunity/ActionPanel'
import { STAGE_LABEL } from '@/lib/constants'

interface Props {
  opportunity: OpportunityFull
  userProfile: Pick<Profile, 'id' | 'name' | 'role'>
  callLogs: CallLogWithProfile[]
  proposals: ProposalWithItems[]
  sampleBatches: SampleBatchWithItems[]
  quotations: Quotation[]
  invoices: Invoice[]
  closers: Pick<Profile, 'id' | 'name' | 'role'>[]
}

export default function OpportunityDetailClient({
  opportunity: initialOpportunity,
  userProfile,
  callLogs: initialCallLogs,
  proposals: initialProposals,
  sampleBatches: initialBatches,
  quotations: initialQuotations,
  invoices,
  closers,
}: Props) {
  const [opportunity, setOpportunity] = useState(initialOpportunity)
  const [callLogs, setCallLogs] = useState(initialCallLogs)
  const [proposals, setProposals] = useState(initialProposals)
  const [sampleBatches, setSampleBatches] = useState(initialBatches)
  const [quotations, setQuotations] = useState(initialQuotations)

  const isCloserOrAdmin = ['closer', 'admin'].includes(userProfile.role)
  const isPostHandoff = [
    'sample_approved', 'samples_shipped', 'samples_delivered', 'quote_sent',
    'collect_feedback', 'deal_won', 'payment_received', 'first_order', 'recurring_customer',
  ].includes(opportunity.stage)

  function handleCustomerUpdate(updated: typeof opportunity.customer) {
    setOpportunity((prev) => ({ ...prev, customer: updated }))
  }

  function handleOpportunityUpdate(updated: Partial<typeof opportunity>) {
    setOpportunity((prev) => ({ ...prev, ...updated }))
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <Link
          href="/opportunities"
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-gray-900 truncate">
            {opportunity.customer.cafe_name}
          </h1>
          <p className="text-xs text-gray-500">
            {opportunity.customer.city && opportunity.customer.state
              ? `${opportunity.customer.city}, ${opportunity.customer.state}`
              : opportunity.customer.country ?? 'Location unknown'}
            {' · '}
            <span className="font-medium">{STAGE_LABEL[opportunity.stage] ?? opportunity.stage}</span>
            {opportunity.assigned_profile && (
              <> · Assigned to {opportunity.assigned_profile.name}</>
            )}
          </p>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: qualification + handoff summary */}
        <aside className="w-80 shrink-0 border-r border-gray-200 overflow-y-auto bg-white">
          {isCloserOrAdmin && isPostHandoff && (
            <HandoffSummaryCard
              opportunity={opportunity}
              customer={opportunity.customer}
            />
          )}
          <QualificationPanel
            customer={opportunity.customer}
            opportunityId={opportunity.opportunity_id}
            userRole={userProfile.role}
            onCustomerUpdate={handleCustomerUpdate}
          />
        </aside>

        {/* Center: timeline */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4">
          <TimelineView
            callLogs={callLogs}
            proposals={proposals}
            sampleBatches={sampleBatches}
            quotations={quotations}
            invoices={invoices}
            customer={opportunity.customer}
            onBatchFeedbackUpdate={(batchId, itemId, feedback) => {
              setSampleBatches((prev) =>
                prev.map((b) =>
                  b.batch_id === batchId
                    ? {
                        ...b,
                        items: b.items.map((i) =>
                          i.item_id === itemId ? { ...i, feedback } : i,
                        ),
                      }
                    : b,
                ),
              )
            }}
          />
        </main>

        {/* Right panel: actions */}
        <aside className="w-72 shrink-0 border-l border-gray-200 overflow-y-auto bg-white p-4">
          <ActionPanel
            opportunity={opportunity}
            userProfile={userProfile}
            closers={closers}
            latestProposal={proposals[0] ?? null}
            onOpportunityUpdate={handleOpportunityUpdate}
            onCallLogged={(log) => setCallLogs((prev) => [log as never, ...prev])}
            onProposalCreated={(p) => setProposals((prev) => [p as never, ...prev])}
            onBatchCreated={(b) => setSampleBatches((prev) => [b as never, ...prev])}
            onQuoteCreated={(q) => setQuotations((prev) => [q, ...prev])}
          />
        </aside>
      </div>
    </div>
  )
}
