'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Instagram, Globe, ChevronRight } from 'lucide-react'
import type { Customer, LeadStage } from '@/types/database'
import MessageComposer from './[id]/MessageComposer'
import OutreachTimeline from './[id]/OutreachTimeline'

interface Props {
  lead: Customer
  canEdit: boolean
  outreachStats: { lastOutreachDate: string | null; outreachCount: number; daysSinceContact: number | null; latestStatus: string | null }
  onClose: () => void
  onDataChanged: () => void
  onLeadUpdated?: (updated: Customer) => void
}

const STAGE_BADGE: Record<string, { label: string; classes: string }> = {
  new_lead:     { label: 'New',          classes: 'bg-slate-100 text-slate-600' },
  contacted:    { label: 'Contacted',    classes: 'bg-blue-50 text-blue-700' },
  replied:      { label: 'Replied',      classes: 'bg-green-50 text-green-700' },
  qualified:    { label: 'Qualified',    classes: 'bg-amber-50 text-amber-700' },
  handed_off:   { label: 'Handed Off',   classes: 'bg-purple-50 text-purple-700' },
  disqualified: { label: 'Disqualified', classes: 'bg-red-50 text-red-600' },
}

const NEXT_STEP: Record<string, { label: string; nextStage: LeadStage }> = {
  new_lead:   { label: 'Mark Contacted',  nextStage: 'contacted' },
  contacted:  { label: 'Mark Replied',     nextStage: 'replied' },
  replied:    { label: 'Mark Qualified',   nextStage: 'qualified' },
}

export default function LeadSidePanel({ lead, canEdit, onClose, onDataChanged, onLeadUpdated }: Props) {
  const router = useRouter()
  const [refreshKey, setRefreshKey] = useState(0)
  const [draftMessage, setDraftMessage] = useState<string | undefined>(undefined)
  const [localStage, setLocalStage] = useState<LeadStage>((lead.lead_stage as LeadStage) ?? 'new_lead')
  const [advancing, setAdvancing] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const [promoteError, setPromoteError] = useState<string | null>(null)

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
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stageBadge.classes}`}>
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
        {/* Next step button */}
        {canEdit && nextStep && (
          <button
            onClick={handleAdvanceStage}
            disabled={advancing}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50 transition-colors"
          >
            {advancing ? 'Updating...' : nextStep.label}
            {!advancing && <ChevronRight className="w-4 h-4" />}
          </button>
        )}

        {/* Promote to Opportunity button — only for qualified leads */}
        {canEdit && localStage === 'qualified' && (
          <div>
            <button
              onClick={handlePromote}
              disabled={promoting}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50 transition-colors"
            >
              {promoting ? 'Promoting...' : 'Promote to Opportunity'}
              {!promoting && <ChevronRight className="w-4 h-4" />}
            </button>
            {promoteError && <p className="text-xs text-red-600 mt-1">{promoteError}</p>}
          </div>
        )}

        {/* Message composer */}
        <MessageComposer
          leadId={lead.customer_id}
          lead={lead}
          canEdit={canEdit}
          onMessageSent={handleMessageSent}
          initialMessage={draftMessage}
          leadStage={localStage}
        />

        {/* Message history */}
        <div className="border-t border-slate-100 pt-3">
          <OutreachTimeline
            leadId={lead.customer_id}
            canEdit={canEdit}
            refreshKey={refreshKey}
            onFollowUp={handleFollowUp}
          />
        </div>
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
    </div>
  )
}
