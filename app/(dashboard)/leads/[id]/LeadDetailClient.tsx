'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Customer, LeadStage, Profile } from '@/types/database'
import { LEAD_STAGE_LABELS } from '@/types/database'
import { formatDate } from '@/lib/utils'
import { isFullyQualified, qualificationProgress } from '@/lib/qualification'
import { CheckCircle, AlertCircle } from 'lucide-react'
import EnrichButton from './EnrichButton'
import ClayEnrichButton from './ClayEnrichButton'
import MessageComposer from './MessageComposer'
import OutreachTimeline from './OutreachTimeline'
import ConvertButton from './ConvertButton'

interface Props {
  lead: Customer
  profiles: Pick<Profile, 'id' | 'name'>[]
  canEdit: boolean
}

type SaveState = 'idle' | 'saving' | 'success' | 'error'

const STAGE_COLORS: Record<LeadStage, string> = {
  new_lead:     'bg-slate-100 text-slate-700',
  contacted:    'bg-blue-50 text-blue-700',
  replied:      'bg-amber-50 text-amber-700',
  qualified:    'bg-green-50 text-green-700',
  handed_off:   'bg-purple-50 text-purple-700',
  disqualified: 'bg-red-50 text-red-600',
}

const QUALIFICATION_VISIBLE_STAGES: LeadStage[] = ['replied', 'qualified', 'handed_off']

export default function LeadDetailClient({ lead, profiles, canEdit }: Props) {
  const router = useRouter()
  const [stage, setStage]       = useState<LeadStage>(lead.lead_stage ?? 'new_lead')
  const [assignedTo, setAssignedTo] = useState<string>(lead.lead_assigned_to ?? '')
  const [notes, setNotes]       = useState<string>(lead.notes ?? '')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [draftMessage, setDraftMessage] = useState<string | undefined>(undefined)

  // Qualification local state
  const [qualProducts, setQualProducts] = useState(lead.qualified_products ?? '')
  const [qualVolume, setQualVolume] = useState(lead.qualified_volume_kg != null ? String(lead.qualified_volume_kg) : '')
  const [qualBudget, setQualBudget] = useState(lead.qualified_budget ?? '')
  const [qualSaving, setQualSaving] = useState(false)

  async function handleSave() {
    setSaveState('saving')
    setSaveError(null)

    try {
      const res = await fetch(`/api/leads/${lead.customer_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_stage:       stage,
          lead_assigned_to: assignedTo || null,
          notes:            notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveState('error')
        setSaveError(data.error ?? 'Save failed')
      } else {
        setSaveState('success')
        if (data.customer?.lead_stage) {
          setStage(data.customer.lead_stage)
        }
        router.refresh()
        setTimeout(() => setSaveState('idle'), 2500)
      }
    } catch {
      setSaveState('error')
      setSaveError('Network error')
    }
  }

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
        if (data.customer?.lead_stage && data.customer.lead_stage !== stage) {
          setStage(data.customer.lead_stage)
        }
      }
    } finally {
      setQualSaving(false)
    }
  }

  const isDirty =
    stage !== (lead.lead_stage ?? 'new_lead') ||
    assignedTo !== (lead.lead_assigned_to ?? '') ||
    notes !== (lead.notes ?? '')

  const showQualification = QUALIFICATION_VISIBLE_STAGES.includes(stage)
  const localQualCustomer = {
    qualified_products: qualProducts || null,
    qualified_volume_kg: qualVolume ? Number(qualVolume) : null,
    qualified_budget: qualBudget || null,
  }
  const progress = qualificationProgress(localQualCustomer)
  const qualified = progress.complete

  return (
    <div className="flex-1 overflow-auto p-6 max-w-4xl mx-auto w-full">
      {/* Back link */}
      <button
        onClick={() => router.back()}
        className="text-xs text-slate-500 hover:text-slate-700 mb-5 flex items-center gap-1"
      >
        ← Back to Leads
      </button>

      <h1 className="text-xl font-semibold text-slate-900 mb-1">{lead.cafe_name}</h1>
      <p className="text-sm text-slate-500 mb-6">
        {[lead.city, lead.country].filter(Boolean).join(', ') || 'Location unknown'}
        {lead.source_region && <> · {lead.source_region}</>}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sheet data (read-only) */}
        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Sheet Data
          </h2>
          <dl className="space-y-3 text-sm">
            <Row label="Cafe Name"     value={lead.cafe_name} />
            <Row label="Location"      value={[lead.city, lead.country].filter(Boolean).join(', ')} />
            <Row label="Serves Matcha" value={
              lead.serves_matcha === null ? null
                : lead.serves_matcha ? 'Yes' : 'No'
            } />
            <Row label="Contact Person" value={lead.contact_person} />
            <Row label="Platform"      value={lead.platform_used} />
            <Row label="Region"        value={lead.source_region} />
            <Row label="Instagram"     value={lead.instagram_url}
              render={(v) => (
                <a href={`https://${v}`} target="_blank" rel="noopener noreferrer"
                   className="text-blue-600 hover:underline truncate block">
                  {v}
                </a>
              )}
            />
            <Row label="Website"       value={lead.website_url}
              render={(v) => (
                <a href={`https://${v}`} target="_blank" rel="noopener noreferrer"
                   className="text-blue-600 hover:underline truncate block">
                  {v}
                </a>
              )}
            />
            <Row label="Date Generated" value={lead.date_generated ? formatDate(lead.date_generated) : null} />
            <Row label="Date Contacted" value={lead.date_contacted ? formatDate(lead.date_contacted) : null} />
            <Row label="Last Imported"  value={lead.last_imported_at ? formatDate(lead.last_imported_at) : null} />
          </dl>
        </section>

        {/* CRM fields (editable) */}
        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
            CRM Fields
          </h2>

          <div className="space-y-4">
            {/* Lead Stage */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              {canEdit ? (
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as LeadStage)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
                >
                  {(Object.entries(LEAD_STAGE_LABELS) as [LeadStage, string][]).map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
              ) : (
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[stage]}`}>
                  {LEAD_STAGE_LABELS[stage]}
                </span>
              )}
            </div>

            {/* Assigned To */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Assigned To</label>
              {canEdit ? (
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Unassigned</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-slate-700">
                  {profiles.find((p) => p.id === assignedTo)?.name ?? '—'}
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              {canEdit ? (
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  placeholder="Internal notes about this lead…"
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              ) : (
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{notes || '—'}</p>
              )}
            </div>

            {/* Contact Enrichment */}
            <EnrichButton lead={lead} canEdit={canEdit} />
            <ClayEnrichButton lead={lead} canEdit={canEdit} />

            {/* Save */}
            {canEdit && (
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleSave}
                  disabled={!isDirty || saveState === 'saving'}
                  className="text-sm font-medium px-4 py-1.5 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saveState === 'saving' ? 'Saving…' : 'Save'}
                </button>
                {saveState === 'success' && (
                  <span className="flex items-center gap-1 text-xs text-green-700">
                    <CheckCircle className="w-3 h-3" /> Saved
                  </span>
                )}
                {saveState === 'error' && (
                  <span className="flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="w-3 h-3" /> {saveError}
                  </span>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Qualification section */}
      {showQualification && (
        <section className="mt-6 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Qualification
            </h2>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
              qualified ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {qualified ? 'Ready to Convert' : `${progress.filled} of 3 complete`}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-slate-100 rounded-full mb-5">
            <div
              className={`h-full rounded-full transition-all ${qualified ? 'bg-green-500' : 'bg-amber-400'}`}
              style={{ width: `${(progress.filled / 3) * 100}%` }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Products interested in */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs ${
                  progress.items[0].filled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  {progress.items[0].filled ? '✓' : '○'}
                </span>
                <label className="text-sm font-medium text-slate-600">Products interested in</label>
              </div>
              {canEdit ? (
                <textarea
                  value={qualProducts}
                  onChange={(e) => setQualProducts(e.target.value)}
                  onBlur={() => saveQualField('qualified_products', qualProducts || null)}
                  placeholder="e.g. Ceremonial Grade, Latte Grade"
                  rows={2}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              ) : (
                <p className="text-sm text-slate-700 ml-7">{qualProducts || '—'}</p>
              )}
            </div>

            {/* Est. monthly volume */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs ${
                  progress.items[1].filled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  {progress.items[1].filled ? '✓' : '○'}
                </span>
                <label className="text-sm font-medium text-slate-600">Est. monthly volume (kg)</label>
              </div>
              {canEdit ? (
                <>
                  <input
                    type="number"
                    value={qualVolume}
                    onChange={(e) => setQualVolume(e.target.value)}
                    onBlur={() => saveQualField('qualified_volume_kg', qualVolume ? Number(qualVolume) : null)}
                    placeholder="e.g. 5, 10, 20"
                    min="0"
                    className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-xs text-slate-400 mt-1 ml-7">Based on conversation with the cafe</p>
                </>
              ) : (
                <p className="text-sm text-slate-700 ml-7">{qualVolume ? `${qualVolume} kg` : '—'}</p>
              )}
            </div>

            {/* Budget range */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs ${
                  progress.items[2].filled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  {progress.items[2].filled ? '✓' : '○'}
                </span>
                <label className="text-sm font-medium text-slate-600">Budget range</label>
              </div>
              {canEdit ? (
                <input
                  type="text"
                  value={qualBudget}
                  onChange={(e) => setQualBudget(e.target.value)}
                  onBlur={() => saveQualField('qualified_budget', qualBudget || null)}
                  placeholder="$XX-XX per kg delivered"
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
                />
              ) : (
                <p className="text-sm text-slate-700 ml-7">{qualBudget || '—'}</p>
              )}
            </div>

          </div>

          {qualSaving && (
            <p className="text-xs text-slate-400 mt-3">Saving...</p>
          )}

          {/* Convert button */}
          {canEdit && (stage === 'replied' || stage === 'qualified') && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <ConvertButton lead={{ ...lead, ...localQualCustomer, lead_stage: stage }} canEdit={canEdit} />
            </div>
          )}
        </section>
      )}

      {/* Outreach & Messages */}
      <section className="mt-6 bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Outreach & Messages
        </h2>
        <MessageComposer
          leadId={lead.customer_id}
          lead={lead}
          canEdit={canEdit}
          onMessageSent={() => { setRefreshKey((k) => k + 1); setDraftMessage(undefined) }}
          initialMessage={draftMessage}
        />
        <div className="mt-4">
          <OutreachTimeline
            leadId={lead.customer_id}
            canEdit={canEdit}
            refreshKey={refreshKey}
            onFollowUp={(text) => setDraftMessage(text)}
          />
        </div>
      </section>
    </div>
  )
}

function Row({
  label, value, render,
}: {
  label: string
  value: string | null | undefined
  render?: (v: string) => React.ReactNode
}) {
  return (
    <div className="flex gap-2">
      <dt className="text-slate-400 shrink-0 w-32">{label}</dt>
      <dd className="text-slate-800 min-w-0 flex-1">
        {value ? (render ? render(value) : value) : <span className="text-slate-300">—</span>}
      </dd>
    </div>
  )
}
