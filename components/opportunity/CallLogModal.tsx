'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { CallLog, Customer, CallType, CallOutcome } from '@/types/database'
import { CALL_TYPE_LABELS, CALL_OUTCOME_LABELS } from '@/lib/constants'

interface Props {
  opportunityId: string
  customerId: string
  userId: string
  customer: Pick<Customer, 'customer_id' | 'cafe_name'>
  onSaved: (log: CallLog) => void
  onClose: () => void
}

const SPOKE_WITH_OPTIONS = ['owner', 'manager', 'bar_manager', 'staff', 'other']

export default function CallLogModal({
  opportunityId,
  customerId,
  userId,
  customer,
  onSaved,
  onClose,
}: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applyIntel, setApplyIntel] = useState(true)

  const [form, setForm] = useState({
    call_type: 'discovery' as CallType,
    called_at: new Date().toISOString().slice(0, 16),  // datetime-local format
    duration_minutes: '',
    spoke_with_role: '',
    spoke_with_name: '',
    outcome: 'follow_up' as CallOutcome,
    raw_summary: '',
    ext_current_supplier: '',
    ext_current_price_per_kg: '',
    ext_likes: '',
    ext_dislikes: '',
    ext_why_switch: '',
    ext_definition_good_matcha: '',
    ext_additional_notes: '',
  })

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const res = await fetch(`/api/opportunities/${opportunityId}/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        customer_id: customerId,
        logged_by: userId,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
        ext_current_price_per_kg: form.ext_current_price_per_kg
          ? parseFloat(form.ext_current_price_per_kg)
          : null,
        intel_applied: applyIntel,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to save call log')
      setSaving(false)
      return
    }

    onSaved(data.callLog)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-sm font-semibold text-gray-900">Log Call · {customer.cafe_name}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Call type" required>
              <select
                value={form.call_type}
                onChange={(e) => set('call_type', e.target.value)}
                className="select-field"
              >
                {(Object.entries(CALL_TYPE_LABELS) as [CallType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>

            <Field label="Outcome" required>
              <select
                value={form.outcome}
                onChange={(e) => set('outcome', e.target.value)}
                className="select-field"
              >
                {(Object.entries(CALL_OUTCOME_LABELS) as [CallOutcome, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date & time" required>
              <input
                type="datetime-local"
                value={form.called_at}
                onChange={(e) => set('called_at', e.target.value)}
                className="input-field"
                required
              />
            </Field>

            <Field label="Duration (min)">
              <input
                type="number"
                min="1"
                value={form.duration_minutes}
                onChange={(e) => set('duration_minutes', e.target.value)}
                placeholder="e.g. 20"
                className="input-field"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Spoke with (role)">
              <select
                value={form.spoke_with_role}
                onChange={(e) => set('spoke_with_role', e.target.value)}
                className="select-field"
              >
                <option value="">Select…</option>
                {SPOKE_WITH_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o.replace('_', ' ')}</option>
                ))}
              </select>
            </Field>

            <Field label="Spoke with (name)">
              <input
                type="text"
                value={form.spoke_with_name}
                onChange={(e) => set('spoke_with_name', e.target.value)}
                placeholder="Name"
                className="input-field"
              />
            </Field>
          </div>

          <Field label="Call summary">
            <textarea
              value={form.raw_summary}
              onChange={(e) => set('raw_summary', e.target.value)}
              rows={3}
              placeholder="What was discussed?"
              className="input-field resize-none"
            />
          </Field>

          {/* Market intel section */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Market Intel from This Call
              </h3>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyIntel}
                  onChange={(e) => setApplyIntel(e.target.checked)}
                  className="rounded"
                />
                Apply to customer record
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Current supplier">
                <input
                  type="text"
                  value={form.ext_current_supplier}
                  onChange={(e) => set('ext_current_supplier', e.target.value)}
                  placeholder="Supplier name"
                  className="input-field"
                />
              </Field>
              <Field label="Current price/kg">
                <input
                  type="number"
                  step="0.01"
                  value={form.ext_current_price_per_kg}
                  onChange={(e) => set('ext_current_price_per_kg', e.target.value)}
                  placeholder="0.00"
                  className="input-field"
                />
              </Field>
            </div>

            <Field label="What they like about current matcha">
              <textarea
                value={form.ext_likes}
                onChange={(e) => set('ext_likes', e.target.value)}
                rows={2}
                className="input-field resize-none"
              />
            </Field>

            <Field label="What they dislike">
              <textarea
                value={form.ext_dislikes}
                onChange={(e) => set('ext_dislikes', e.target.value)}
                rows={2}
                className="input-field resize-none"
              />
            </Field>

            <Field label="Why they want to switch">
              <textarea
                value={form.ext_why_switch}
                onChange={(e) => set('ext_why_switch', e.target.value)}
                rows={2}
                className="input-field resize-none"
              />
            </Field>

            <Field label="Definition of good matcha">
              <textarea
                value={form.ext_definition_good_matcha}
                onChange={(e) => set('ext_definition_good_matcha', e.target.value)}
                rows={2}
                className="input-field resize-none"
              />
            </Field>

            <Field label="Additional notes">
              <textarea
                value={form.ext_additional_notes}
                onChange={(e) => set('ext_additional_notes', e.target.value)}
                rows={2}
                className="input-field resize-none"
              />
            </Field>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Call Log'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .input-field  { width: 100%; border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.375rem 0.625rem; font-size: 0.875rem; outline: none; }
        .input-field:focus { border-color: #6ee7b7; box-shadow: 0 0 0 2px rgba(110,231,183,0.3); }
        .select-field { width: 100%; border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.375rem 0.625rem; font-size: 0.875rem; background: white; outline: none; }
        .select-field:focus { border-color: #6ee7b7; box-shadow: 0 0 0 2px rgba(110,231,183,0.3); }
      `}</style>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
