'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  Plus,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FormState = 'idle' | 'submitting' | 'duplicate_warning' | 'success' | 'error'

interface DuplicateInfo {
  customer_id: string
  cafe_name: string
  city: string | null
  country: string | null
}

const INITIAL_FORM = {
  cafe_name: '',
  city: '',
  country: '',
  instagram_url: '',
  website_url: '',
  email: '',
  contact_person: '',
  phone: '',
  notes: '',
  serves_matcha: null as boolean | null,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ManualLeadForm({ onClose }: { onClose?: () => void }) {

  const [form, setForm] = useState(INITIAL_FORM)
  const [state, setState] = useState<FormState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null)

  function updateField(field: keyof typeof INITIAL_FORM, value: string | boolean | null) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // ---- Submit ----

  async function handleSubmit(force = false) {
    if (!form.cafe_name.trim()) return

    setState('submitting')
    setErrorMsg(null)

    try {
      const res = await fetch('/api/leads/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cafe_name: form.cafe_name.trim(),
          city: form.city.trim() || null,
          country: form.country.trim() || null,
          instagram_url: form.instagram_url.trim() || null,
          website_url: form.website_url.trim() || null,
          email: form.email.trim() || null,
          contact_person: form.contact_person.trim() || null,
          phone: form.phone.trim() || null,
          notes: form.notes.trim() || null,
          serves_matcha: form.serves_matcha,
          force,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setState('error')
        setErrorMsg(data.error ?? 'Failed to add lead')
        return
      }

      if (data.duplicate) {
        setDuplicate(data.existing)
        setState('duplicate_warning')
        return
      }

      setState('success')
      setForm(INITIAL_FORM)
      setTimeout(() => window.location.reload(), 2000)
    } catch {
      setState('error')
      setErrorMsg('Network error')
    }
  }

  // ---- Render ----

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 space-y-3 flex-1 overflow-auto">
        {/* Cafe Name (required) */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Cafe Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.cafe_name}
            onChange={(e) => updateField('cafe_name', e.target.value)}
            placeholder="e.g. Matcha House"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        {/* City + Country */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => updateField('city', e.target.value)}
              placeholder="e.g. Portland"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Country</label>
            <input
              type="text"
              value={form.country}
              onChange={(e) => updateField('country', e.target.value)}
              placeholder="e.g. United States"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Instagram + Website */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Instagram URL</label>
            <input
              type="text"
              value={form.instagram_url}
              onChange={(e) => updateField('instagram_url', e.target.value)}
              placeholder="https://instagram.com/..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Website URL</label>
            <input
              type="text"
              value={form.website_url}
              onChange={(e) => updateField('website_url', e.target.value)}
              placeholder="https://..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Email + Phone */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="cafe@example.com"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="+1 555-123-4567"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Contact Person */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Contact Person</label>
          <input
            type="text"
            value={form.contact_person}
            onChange={(e) => updateField('contact_person', e.target.value)}
            placeholder="e.g. John Smith"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        {/* Serves Matcha */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Serves Matcha?</label>
          <div className="flex gap-2">
            {([
              { value: null, label: 'Unknown' },
              { value: true, label: 'Yes' },
              { value: false, label: 'No' },
            ] as const).map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => updateField('serves_matcha', opt.value)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  form.serves_matcha === opt.value
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="Any additional notes..."
            rows={2}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Duplicate warning */}
        {state === 'duplicate_warning' && duplicate && (
          <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200 space-y-2">
            <div className="flex items-center gap-2 text-yellow-800 text-sm font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Potential duplicate found
            </div>
            <p className="text-xs text-yellow-700">
              &ldquo;{duplicate.cafe_name}&rdquo;
              {duplicate.city || duplicate.country
                ? ` in ${[duplicate.city, duplicate.country].filter(Boolean).join(', ')}`
                : ''}{' '}
              already exists in the CRM.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleSubmit(true)}
                className="text-xs font-medium px-3 py-1 rounded-lg bg-yellow-600 text-white hover:bg-yellow-700 transition-colors"
              >
                Add Anyway
              </button>
              <button
                onClick={() => {
                  setState('idle')
                  setDuplicate(null)
                }}
                className="text-xs font-medium px-3 py-1 rounded-lg bg-white text-yellow-700 border border-yellow-300 hover:bg-yellow-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Success */}
        {state === 'success' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-800 text-sm">
            <CheckCircle className="w-4 h-4 shrink-0" />
            Lead added successfully!
          </div>
        )}

        {/* Error */}
        {state === 'error' && errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 shrink-0">
        <button
          onClick={onClose}
          className="text-sm text-slate-600 hover:text-slate-800 px-3 py-1.5"
        >
          Cancel
        </button>
        <button
          onClick={() => handleSubmit(false)}
          disabled={
            !form.cafe_name.trim() ||
            state === 'submitting' ||
            state === 'success'
          }
          className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state === 'submitting' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          {state === 'submitting' ? 'Adding...' : 'Add Lead'}
        </button>
      </div>
    </div>
  )
}
