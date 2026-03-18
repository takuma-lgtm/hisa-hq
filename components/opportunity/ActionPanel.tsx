'use client'

import { useState } from 'react'
import { Phone, FileText, Package, BarChart2, CheckCircle, XCircle, ArrowRightCircle, DollarSign } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type {
  OpportunityFull,
  Profile,
  ProposalWithItems,
  CallLog,
  SampleBatchWithItems,
  Quotation,
} from '@/types/database'
import { STAGE_LABEL } from '@/lib/constants'
import CallLogModal from './CallLogModal'
import ProposalBuilder from './ProposalBuilder'
import SampleBatchForm from './SampleBatchForm'

interface Props {
  opportunity: OpportunityFull
  userProfile: Pick<Profile, 'id' | 'name' | 'role'>
  closers: Pick<Profile, 'id' | 'name' | 'role'>[]
  latestProposal: ProposalWithItems | null
  onOpportunityUpdate: (updated: Partial<OpportunityFull>) => void
  onCallLogged: (log: CallLog) => void
  onProposalCreated: (proposal: ProposalWithItems) => void
  onBatchCreated: (batch: SampleBatchWithItems) => void
  onQuoteCreated: (quote: Quotation) => void
}

export default function ActionPanel({
  opportunity,
  userProfile,
  latestProposal,
  onOpportunityUpdate,
  onCallLogged,
  onProposalCreated,
  onBatchCreated,
}: Props) {
  const [modal, setModal] = useState<'call' | 'proposal' | 'sample' | 'disqualify' | null>(null)
  const [loading, setLoading] = useState(false)
  const [disqualifyReason, setDisqualifyReason] = useState('')

  const supabase = createClient()
  const role = userProfile.role
  const stage = opportunity.stage

  async function advanceStage(newStage: string) {
    setLoading(true)
    const { error } = await supabase
      .from('opportunities')
      .update({ stage: newStage as never })
      .eq('opportunity_id', opportunity.opportunity_id)
    if (!error) onOpportunityUpdate({ stage: newStage as never })
    setLoading(false)
  }

  async function disqualify() {
    setLoading(true)
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('opportunities')
      .update({ stage: 'disqualified', disqualified_at: now, disqualified_reason: disqualifyReason })
      .eq('opportunity_id', opportunity.opportunity_id)
    if (!error) {
      onOpportunityUpdate({ stage: 'disqualified', disqualified_at: now, disqualified_reason: disqualifyReason })
      setModal(null)
    }
    setLoading(false)
  }

  const isLeadGen = role === 'member'
  const isCloserOrAdmin = role === 'owner' || role === 'admin'
  const isTerminal = stage === 'disqualified' || stage === 'lost'

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Actions</h2>

      {/* Current stage badge */}
      <div className="text-xs text-gray-600 mb-4">
        Stage: <span className="font-medium text-gray-900">{STAGE_LABEL[stage] ?? stage}</span>
      </div>

      {/* Log Call — available to all roles at any stage */}
      {!isTerminal && (
        <ActionButton
          icon={<Phone className="w-3.5 h-3.5" />}
          label="Log Call"
          onClick={() => setModal('call')}
          variant="default"
        />
      )}

      {/* Lead gen actions */}
      {isLeadGen && !isTerminal && (
        <ActionButton
          icon={<FileText className="w-3.5 h-3.5" />}
          label="Create Proposal"
          onClick={() => setModal('proposal')}
          variant="default"
        />
      )}

      {/* Stage-specific closer actions */}
      {isCloserOrAdmin && !isTerminal && (
        <>
          {stage === 'sample_approved' && (
            <ActionButton
              icon={<Package className="w-3.5 h-3.5" />}
              label="Create Sample Batch"
              onClick={() => setModal('sample')}
              variant="primary"
            />
          )}

          {stage === 'samples_shipped' && (
            <ActionButton
              icon={<CheckCircle className="w-3.5 h-3.5" />}
              label="Mark Samples Delivered"
              onClick={() => advanceStage('samples_delivered')}
              variant="primary"
              loading={loading}
            />
          )}

          {stage === 'samples_delivered' && (
            <ActionButton
              icon={<BarChart2 className="w-3.5 h-3.5" />}
              label="Send Quote"
              onClick={() => advanceStage('quote_sent')}
              variant="primary"
              loading={loading}
            />
          )}

          {stage === 'quote_sent' && (
            <ActionButton
              icon={<ArrowRightCircle className="w-3.5 h-3.5" />}
              label="Move to Collect Feedback"
              onClick={() => advanceStage('collect_feedback')}
              variant="default"
              loading={loading}
            />
          )}

          {stage === 'collect_feedback' && (
            <ActionButton
              icon={<CheckCircle className="w-3.5 h-3.5" />}
              label="Mark Deal Won"
              onClick={() => advanceStage('deal_won')}
              variant="primary"
              loading={loading}
            />
          )}

          {stage === 'deal_won' && (
            <ActionButton
              icon={<DollarSign className="w-3.5 h-3.5" />}
              label="Mark Payment Received"
              onClick={() => advanceStage('payment_received')}
              variant="primary"
              loading={loading}
            />
          )}

          {stage === 'payment_received' && (
            <ActionButton
              icon={<Package className="w-3.5 h-3.5" />}
              label="Mark First Order"
              onClick={() => advanceStage('first_order')}
              variant="primary"
              loading={loading}
            />
          )}

          {stage === 'first_order' && (
            <ActionButton
              icon={<CheckCircle className="w-3.5 h-3.5" />}
              label="Convert to Recurring Customer"
              onClick={async () => {
                setLoading(true)
                const now = new Date().toISOString()
                await supabase
                  .from('customers')
                  .update({ status: 'recurring_customer' })
                  .eq('customer_id', opportunity.customer_id)
                await supabase
                  .from('opportunities')
                  .update({ stage: 'recurring_customer' })
                  .eq('opportunity_id', opportunity.opportunity_id)
                onOpportunityUpdate({ stage: 'recurring_customer' as never })
                setLoading(false)
              }}
              variant="primary"
              loading={loading}
            />
          )}
        </>
      )}

      {/* Disqualify — available to anyone, any active stage */}
      {!isTerminal && (
        <ActionButton
          icon={<XCircle className="w-3.5 h-3.5" />}
          label="Mark Disqualified"
          onClick={() => setModal('disqualify')}
          variant="danger"
        />
      )}

      {/* Modals */}
      <CallLogModal
        opportunityId={opportunity.opportunity_id}
        customerId={opportunity.customer_id}
        userId={userProfile.id}
        customer={opportunity.customer}
        open={modal === 'call'}
        onOpenChange={(open) => { if (!open) setModal(null) }}
        onSaved={(log) => { onCallLogged(log); setModal(null) }}
      />

      {modal === 'proposal' && (
        <ProposalBuilder
          opportunityId={opportunity.opportunity_id}
          userId={userProfile.id}
          onSaved={(p) => { onProposalCreated(p); setModal(null) }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'sample' && (
        <SampleBatchForm
          opportunityId={opportunity.opportunity_id}
          customerId={opportunity.customer_id}
          latestProposal={latestProposal}
          onSaved={(b) => { onBatchCreated(b); setModal(null) }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'disqualify' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Mark as Disqualified</h2>
            <p className="text-sm text-gray-500 mb-4">Provide a reason so the team knows why this lead didn&apos;t progress.</p>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 mb-4 resize-none"
              rows={3}
              placeholder="Reason for disqualification…"
              value={disqualifyReason}
              onChange={(e) => setDisqualifyReason(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={disqualify}
                disabled={loading}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                Disqualify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface ActionButtonProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  variant: 'primary' | 'default' | 'danger'
  loading?: boolean
}

function ActionButton({ icon, label, onClick, variant, loading }: ActionButtonProps) {
  const styles = {
    primary: 'bg-slate-800 hover:bg-slate-900 text-white',
    default: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300',
    danger: 'bg-white hover:bg-red-50 text-red-600 border border-red-200',
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${styles[variant]}`}
    >
      {icon}
      {loading ? 'Saving…' : label}
    </button>
  )
}
