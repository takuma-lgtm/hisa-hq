'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Customer, LeadStage } from '@/types/database'
import { LEAD_STAGE_LABELS } from '@/types/database'
import { qualificationProgress } from '@/lib/qualification'
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

const QUALIFICATION_EDITABLE_STAGES: LeadStage[] = ['replied']
const QUALIFICATION_READONLY_STAGES: LeadStage[] = ['qualified', 'handed_off']

export default function LeadSidePanel({ lead, canEdit, outreachStats, onClose, onDataChanged, onLeadUpdated }: Props) {
  const router = useRouter()
  const [refreshKey, setRefreshKey] = useState(0)
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [draftMessage, setDraftMessage] = useState<string | undefined>(undefined)
  const [localStage, setLocalStage] = useState<LeadStage>((lead.lead_stage as LeadStage) ?? 'new_lead')

  // Local qualification state for auto-save
  const [qualProducts, setQualProducts] = useState(lead.qualified_products ?? '')
  const [qualVolume, setQualVolume] = useState(lead.qualified_volume_kg != null ? String(lead.qualified_volume_kg) : '')
  const [qualBudget, setQualBudget] = useState(lead.qualified_budget ?? '')
  const [qualSaving, setQualSaving] = useState(false)

  // Reset local state when lead changes
  const [prevLeadId, setPrevLeadId] = useState(lead.customer_id)
  if (lead.customer_id !== prevLeadId) {
    setPrevLeadId(lead.customer_id)
    setQualProducts(lead.qualified_products ?? '')
    setQualVolume(lead.qualified_volume_kg != null ? String(lead.qualified_volume_kg) : '')
    setQualBudget(lead.qualified_budget ?? '')
    setLocalStage((lead.lead_stage as LeadStage) ?? 'new_lead')
  }

  const handleMessageSent = useCallback(() => {
    setRefreshKey((k) => k + 1)
    setDraftMessage(undefined)
    onDataChanged()
  }, [onDataChanged])

  const handleFollowUp = useCallback((messageText: string) => {
    setDraftMessage(messageText)
  }, [])

  const stage = localStage
  const showQualEditable = QUALIFICATION_EDITABLE_STAGES.includes(stage)
  const showQualReadonly = QUALIFICATION_READONLY_STAGES.includes(stage)

  async function handleStageChange(newStage: LeadStage) {
    setLocalStage(newStage)
    try {
      const res = await fetch(`/api/leads/${lead.customer_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_stage: newStage }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.customer && onLeadUpdated) onLeadUpdated(data.customer)
      }
    } catch { /* silent */ }
  }

  const localQualCustomer = {
    qualified_products: qualProducts || null,
    qualified_volume_kg: qualVolume ? Number(qualVolume) : null,
    qualified_budget: qualBudget || null,
  }
  const progress = qualificationProgress(localQualCustomer)
  const qualified = progress.complete

  async function saveQualField(field: string, value: unknown) {
    setQualSaving(true)
    try {
      const res = await fetch(`/api/leads/${lead.customer_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.customer && onLeadUpdated) {
          onLeadUpdated(data.customer)
        }
      }
    } finally {
      setQualSaving(false)
    }
  }

  async function handleConvert() {
    setConverting(true)
    setConvertError(null)
    try {
      const res = await fetch(`/api/leads/${lead.customer_id}/convert`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && data.opportunity_id) {
          router.push(`/opportunities/${data.opportunity_id}`)
          return
        }
        throw new Error(data.error || 'Failed to convert')
      }
      router.push(`/opportunities/${data.opportunity_id}`)
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : 'Failed to convert')
      setShowConvertModal(false)
    } finally {
      setConverting(false)
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
          <select
            value={stage}
            onChange={(e) => handleStageChange(e.target.value as LeadStage)}
            className="text-xs border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-green-500 bg-white"
          >
            {(Object.entries(LEAD_STAGE_LABELS) as [LeadStage, string][]).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
          {(showQualEditable || showQualReadonly) && (
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
              qualified ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {qualified ? 'Ready to Convert' : `Qualification: ${progress.filled}/3`}
            </span>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Message composer */}
        <MessageComposer
          leadId={lead.customer_id}
          lead={lead}
          canEdit={canEdit}
          onMessageSent={handleMessageSent}
          initialMessage={draftMessage}
        />

        {/* Qualification checklist — editable for 'replied' stage */}
        {showQualEditable && canEdit && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-slate-50">
              <span className="text-xs font-medium text-slate-700">
                Qualification: {progress.filled}/3 complete
              </span>
            </div>
            <div className="h-1 bg-slate-100">
              <div
                className={`h-full transition-all ${qualified ? 'bg-green-500' : 'bg-amber-400'}`}
                style={{ width: `${(progress.filled / 3) * 100}%` }}
              />
            </div>
            <div className="px-3 py-2 space-y-3">
              <div className="flex items-start gap-2">
                <span className={`mt-1 w-4 h-4 flex items-center justify-center rounded-full text-xs ${
                  progress.items[0].filled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  {progress.items[0].filled ? '✓' : '○'}
                </span>
                <div className="flex-1 min-w-0">
                  <label className="text-xs text-slate-500 block mb-0.5">Products interested in</label>
                  <input
                    type="text"
                    value={qualProducts}
                    onChange={(e) => setQualProducts(e.target.value)}
                    onBlur={() => saveQualField('qualified_products', qualProducts || null)}
                    placeholder="e.g. Ceremonial Grade, Latte Grade"
                    className="w-full text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className={`mt-1 w-4 h-4 flex items-center justify-center rounded-full text-xs ${
                  progress.items[1].filled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  {progress.items[1].filled ? '✓' : '○'}
                </span>
                <div className="flex-1 min-w-0">
                  <label className="text-xs text-slate-500 block mb-0.5">Est. monthly volume (kg)</label>
                  <input
                    type="number"
                    value={qualVolume}
                    onChange={(e) => setQualVolume(e.target.value)}
                    onBlur={() => saveQualField('qualified_volume_kg', qualVolume ? Number(qualVolume) : null)}
                    placeholder="e.g. 5, 10, 20"
                    min="0"
                    className="w-full text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className={`mt-1 w-4 h-4 flex items-center justify-center rounded-full text-xs ${
                  progress.items[2].filled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  {progress.items[2].filled ? '✓' : '○'}
                </span>
                <div className="flex-1 min-w-0">
                  <label className="text-xs text-slate-500 block mb-0.5">Budget range</label>
                  <input
                    type="text"
                    value={qualBudget}
                    onChange={(e) => setQualBudget(e.target.value)}
                    onBlur={() => saveQualField('qualified_budget', qualBudget || null)}
                    placeholder="e.g. $30-40/kg"
                    className="w-full text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
              </div>
              {qualSaving && <p className="text-xs text-slate-400">Saving...</p>}
            </div>
            {/* Convert button inside qualification card */}
            <div className="px-3 py-2 border-t border-slate-100">
              <button
                onClick={() => setShowConvertModal(true)}
                className="w-full px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-green-600 text-white hover:bg-green-700"
              >
                Convert to Opportunity
              </button>
              {convertError && <p className="text-xs text-red-600 mt-1">{convertError}</p>}
            </div>
          </div>
        )}

        {/* Qualification summary — read-only for 'qualified' / 'handed_off' stages */}
        {showQualReadonly && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-green-50">
              <span className="text-xs font-medium text-green-700">Qualification Complete</span>
            </div>
            <div className="px-3 py-2 space-y-2">
              {progress.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`w-4 h-4 flex items-center justify-center rounded-full text-xs ${
                    item.filled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {item.filled ? '✓' : '○'}
                  </span>
                  <span className="text-xs text-slate-500">{item.label}:</span>
                  <span className="text-xs text-slate-700 font-medium">
                    {i === 0 && (qualProducts || '—')}
                    {i === 1 && (qualVolume ? `${qualVolume} kg/month` : '—')}
                    {i === 2 && (qualBudget || '—')}
                  </span>
                </div>
              ))}
            </div>
            {stage === 'qualified' && canEdit && (
              <div className="px-3 py-2 border-t border-slate-100">
                <button
                  onClick={() => setShowConvertModal(true)}
                  className="w-full px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-green-600 text-white hover:bg-green-700"
                >
                  Convert to Opportunity
                </button>
                {convertError && <p className="text-xs text-red-600 mt-1">{convertError}</p>}
              </div>
            )}
          </div>
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
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-200 shrink-0">
        <Link
          href={`/leads/${lead.customer_id}`}
          className="text-xs text-green-600 hover:text-green-700 hover:underline"
        >
          Open Full Detail →
        </Link>
      </div>

      {/* Convert confirmation modal */}
      {showConvertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Convert {lead.cafe_name} to an Opportunity?
            </h3>
            <div className="space-y-2">
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <span className="text-slate-400">Products:</span>
                <span className="text-slate-700">{qualProducts || '—'}</span>
                <span className="text-slate-400">Volume:</span>
                <span className="text-slate-700">{qualVolume ? `${qualVolume} kg/month` : '—'}</span>
                <span className="text-slate-400">Budget:</span>
                <span className="text-slate-700">{qualBudget || '—'}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              This will move the lead to the Opportunities pipeline.
            </p>
            {convertError && <p className="text-xs text-red-600">{convertError}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConvertModal(false)}
                disabled={converting}
                className="px-3 py-1.5 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConvert}
                disabled={converting}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {converting ? 'Converting...' : 'Convert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
