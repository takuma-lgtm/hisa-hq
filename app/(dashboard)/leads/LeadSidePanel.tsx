'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Instagram, Globe, ChevronRight } from 'lucide-react'
import type { Customer, LeadStage } from '@/types/database'
import MessageComposer from './[id]/MessageComposer'
import OutreachTimeline from './[id]/OutreachTimeline'
import LeadIntelModal from './LeadIntelModal'

interface Props {
  lead: Customer
  canEdit: boolean
  outreachStats: { lastOutreachDate: string | null; outreachCount: number; daysSinceContact: number | null; latestStatus: string | null }
  onClose: () => void
  onDataChanged: () => void
  onLeadUpdated?: (updated: Customer) => void
}

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function getSuggestion(days: number | null): { text: string; bg: string; textColor: string } {
  if (days === null || days === 0)
    return { text: 'Just sent — wait a couple of days before following up.', bg: 'bg-slate-50', textColor: 'text-slate-600' }
  if (days <= 2)
    return { text: 'Too soon to follow up — give it a bit more time.', bg: 'bg-slate-50', textColor: 'text-slate-600' }
  if (days <= 6)
    return { text: 'Good time for a gentle follow-up.', bg: 'bg-blue-50', textColor: 'text-blue-700' }
  if (days <= 13)
    return { text: "It's been a while — consider sending your product guide.", bg: 'bg-amber-50', textColor: 'text-amber-700' }
  return { text: 'No response in 2+ weeks — try a different angle or disqualify.', bg: 'bg-red-50', textColor: 'text-red-600' }
}

const STAGE_BADGE: Record<string, { label: string; dot: string; classes: string }> = {
  new_lead:     { label: 'New',          dot: 'bg-slate-400',   classes: 'bg-slate-100 text-slate-600 border border-slate-300' },
  contacted:    { label: 'Contacted',    dot: 'bg-blue-500',    classes: 'bg-blue-50 text-blue-700 border border-blue-200' },
  replied:      { label: 'Replied',      dot: 'bg-green-500',   classes: 'bg-green-50 text-green-700 border border-green-200' },
  qualified:    { label: 'Qualified',    dot: 'bg-amber-500',   classes: 'bg-amber-50 text-amber-700 border border-amber-200' },
  handed_off:   { label: 'Promoted',     dot: 'bg-purple-500',  classes: 'bg-purple-50 text-purple-700 border border-purple-200' },
  disqualified: { label: 'Disqualified', dot: 'bg-red-400',     classes: 'bg-red-50 text-red-600 border border-red-200' },
}

const NEXT_STEP: Record<string, { label: string; nextStage: LeadStage }> = {
  new_lead:   { label: 'Mark as Contacted',  nextStage: 'contacted' },
  contacted:  { label: 'Mark as Replied',    nextStage: 'replied' },
}


export default function LeadSidePanel({ lead, canEdit, outreachStats, onClose, onDataChanged, onLeadUpdated }: Props) {
  const router = useRouter()
  const [refreshKey, setRefreshKey] = useState(0)
  const [draftMessage, setDraftMessage] = useState<string | undefined>(undefined)
  const [localStage, setLocalStage] = useState<LeadStage>((lead.lead_stage as LeadStage) ?? 'new_lead')
  const [advancing, setAdvancing] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const [promoteError, setPromoteError] = useState<string | null>(null)
  const [disqualifying, setDisqualifying] = useState(false)
  const [intelModal, setIntelModal] = useState<null | 'promote' | 'disqualify'>(null)

  // Reset local stage when lead changes
  const [prevLeadId, setPrevLeadId] = useState(lead.customer_id)
  if (lead.customer_id !== prevLeadId) {
    setPrevLeadId(lead.customer_id)
    setLocalStage((lead.lead_stage as LeadStage) ?? 'new_lead')
    setPromoteError(null)
  }

  const handleMessageSent = useCallback(() => {
    setRefreshKey((k) => k + 1)
    setDraftMessage(undefined)
    onDataChanged()
  }, [onDataChanged])

  const handleFollowUp = useCallback((messageText: string) => {
    setDraftMessage(messageText)
  }, [])

  const stageBadge = STAGE_BADGE[localStage] ?? STAGE_BADGE.new_lead
  const nextStep = NEXT_STEP[localStage]

  async function handleAdvanceStage() {
    if (!nextStep) return
    setAdvancing(true)
    try {
      const res = await fetch(`/api/leads/${lead.customer_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_stage: nextStep.nextStage }),
      })
      if (res.ok) {
        setLocalStage(nextStep.nextStage)
        const data = await res.json()
        if (data.customer && onLeadUpdated) onLeadUpdated(data.customer)
      }
    } finally {
      setAdvancing(false)
    }
  }

  async function handleDisqualify() {
    setDisqualifying(true)
    try {
      const res = await fetch(`/api/leads/${lead.customer_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_stage: 'disqualified' }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.customer && onLeadUpdated) onLeadUpdated(data.customer)
        onClose()
      }
    } finally {
      setDisqualifying(false)
    }
  }

  async function handlePromote() {
    setPromoting(true)
    setPromoteError(null)
    try {
      const res = await fetch(`/api/leads/${lead.customer_id}/convert`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && data.opportunity_id) {
          router.push(`/opportunities/${data.opportunity_id}`)
          return
        }
        throw new Error(data.error || 'Failed to promote')
      }
      router.push(`/opportunities/${data.opportunity_id}`)
    } catch (err) {
      setPromoteError(err instanceof Error ? err.message : 'Failed to promote')
    } finally {
      setPromoting(false)
    }
  }

  const isContactedStage = localStage === 'contacted'
  const isDecisionStage = localStage === 'replied'
  const firstContactedDays = daysAgo(lead.date_contacted ?? null)
  const suggestion = getSuggestion(outreachStats.daysSinceContact)

  return (
    <div className="w-[400px] shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 truncate">{lead.cafe_name}</h2>
            <p className="text-xs text-slate-500 truncate">
              {[lead.city, lead.state, lead.country].filter(Boolean).join(', ') || '—'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 shrink-0"
            aria-label="Close panel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${stageBadge.classes}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${stageBadge.dot}`} />
            {stageBadge.label}
          </span>
          {lead.instagram_url && (
            <a
              href={lead.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-pink-600 transition-colors"
              title="Instagram"
            >
              <Instagram className="w-3.5 h-3.5" />
            </a>
          )}
          {lead.website_url && (
            <a
              href={lead.website_url.startsWith('http') ? lead.website_url : `https://${lead.website_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-blue-600 transition-colors"
              title="Website"
            >
              <Globe className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {isContactedStage ? (
          <>
            {/* Stats row */}
            <div className="flex items-center gap-3 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2.5">
              <span>
                First contacted{' '}
                <span className="font-medium text-slate-700">
                  {firstContactedDays !== null ? `${firstContactedDays}d ago` : '—'}
                </span>
              </span>
              <span className="text-slate-300">·</span>
              <span>
                <span className="font-medium text-slate-700">{outreachStats.outreachCount}</span>{' '}
                {outreachStats.outreachCount === 1 ? 'message' : 'messages'} sent
              </span>
            </div>

            {/* Follow-up suggestion */}
            <div className={`rounded-lg px-3 py-2.5 ${suggestion.bg}`}>
              <p className={`text-xs ${suggestion.textColor}`}>
                <span className="font-medium">Next step: </span>{suggestion.text}
              </p>
            </div>

            {/* Message composer */}
            <MessageComposer
              leadId={lead.customer_id}
              lead={lead}
              canEdit={canEdit}
              onMessageSent={handleMessageSent}
              initialMessage={draftMessage}
              leadStage={localStage}
            />

            {/* Mark as Replied */}
            {canEdit && (
              <button
                onClick={handleAdvanceStage}
                disabled={advancing}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold rounded-md bg-green-600 text-white hover:bg-green-700 active:scale-[0.98] disabled:opacity-50 transition-all"
              >
                {advancing ? 'Updating...' : 'Mark as Replied'}
                {!advancing && <ChevronRight className="w-4 h-4" />}
              </button>
            )}

            {/* Disqualify */}
            {canEdit && (
              <button
                onClick={() => setIntelModal('disqualify')}
                disabled={disqualifying}
                className="w-full py-2 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                {disqualifying ? 'Disqualifying...' : 'Disqualify this lead'}
              </button>
            )}

            {/* Message history */}
            <div className="border-t border-slate-100 pt-3">
              <OutreachTimeline
                leadId={lead.customer_id}
                canEdit={canEdit}
                refreshKey={refreshKey}
                onFollowUp={handleFollowUp}
              />
            </div>
          </>
        ) : isDecisionStage ? (
          <>
            {/* Decision panel: replied — history first, then promote or disqualify */}
            <OutreachTimeline
              leadId={lead.customer_id}
              canEdit={canEdit}
              refreshKey={refreshKey}
              onFollowUp={handleFollowUp}
            />

            <div className="border-t border-slate-100 pt-4 space-y-2">
              {canEdit && localStage === 'replied' && (
                <div>
                  <button
                    onClick={() => setIntelModal('promote')}
                    disabled={promoting}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold rounded-md bg-green-600 text-white hover:bg-green-700 active:scale-[0.98] disabled:opacity-50 transition-all"
                  >
                    {promoting ? 'Promoting...' : 'Mark as Promoted'}
                    {!promoting && <ChevronRight className="w-4 h-4" />}
                  </button>
                  {promoteError && <p className="text-xs text-red-600 mt-1">{promoteError}</p>}
                </div>
              )}

              {canEdit && (
                <button
                  onClick={() => setIntelModal('disqualify')}
                  disabled={disqualifying}
                  className="w-full py-2 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {disqualifying ? 'Disqualifying...' : 'Disqualify this lead'}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Default layout: new_lead and other stages */}
            <MessageComposer
              leadId={lead.customer_id}
              lead={lead}
              canEdit={canEdit}
              onMessageSent={handleMessageSent}
              initialMessage={draftMessage}
              leadStage={localStage}
            />

            {canEdit && nextStep && (
              <button
                onClick={handleAdvanceStage}
                disabled={advancing}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold rounded-md bg-green-600 text-white hover:bg-green-700 active:scale-[0.98] disabled:opacity-50 transition-all"
              >
                {advancing ? 'Updating...' : nextStep.label}
                {!advancing && <ChevronRight className="w-4 h-4" />}
              </button>
            )}

            <div className="border-t border-slate-100 pt-3">
              <OutreachTimeline
                leadId={lead.customer_id}
                canEdit={canEdit}
                refreshKey={refreshKey}
                onFollowUp={handleFollowUp}
              />
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-200 shrink-0">
        <Link
          href={`/leads/${lead.customer_id}`}
          className="text-xs text-slate-600 hover:text-slate-700 hover:underline"
        >
          Open Full Detail →
        </Link>
      </div>

      {/* Lead intel modal — intercepts promote and disqualify */}
      {intelModal && (
        <LeadIntelModal
          lead={lead}
          mode={intelModal}
          onClose={() => setIntelModal(null)}
          onConfirm={() => {
            setIntelModal(null)
            if (intelModal === 'promote') handlePromote()
            else handleDisqualify()
          }}
        />
      )}
    </div>
  )
}
