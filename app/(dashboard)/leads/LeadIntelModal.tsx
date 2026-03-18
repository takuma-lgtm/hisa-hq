'use client'

import { useState } from 'react'
import type { Customer } from '@/types/database'

interface Props {
  lead: Customer
  mode: 'promote' | 'disqualify'
  onConfirm: () => void
  onClose: () => void
}

const VOLUME_OPTIONS = [
  { label: '<1 kg', value: 0.5 },
  { label: '1–5 kg', value: 3 },
  { label: '5–20 kg', value: 12.5 },
  { label: '20+ kg', value: 25 },
]

const INTEREST_OPTIONS = ['Excited', 'Curious', 'Passive', 'Not interested']
const BUCKET_OPTIONS = ['Cost Efficient', 'One Fits All', 'Quality Driven']
const PAIN_POINT_OPTIONS = ['Price', 'Quality', 'Sourcing story', 'Availability', 'Just curious']
const DISQUALIFY_REASONS = [
  'Happy with supplier',
  'Volume too small',
  'Wrong contact',
  'Price mismatch',
  'Went cold',
  'Other',
]

function volumeToOption(kg: number | null): number | null {
  if (kg === null) return null
  if (kg <= 1) return 0.5
  if (kg <= 5) return 3
  if (kg <= 20) return 12.5
  return 25
}

export default function LeadIntelModal({ lead, mode, onConfirm, onClose }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Section 1 — Cafe Intelligence
  const [servesMatcha, setServesMatcha] = useState<boolean | null>(lead.serves_matcha ?? null)
  const [interestLevel, setInterestLevel] = useState(lead.matcha_interest_level ?? '')
  const [bucket, setBucket] = useState(lead.customer_bucket ?? '')
  const [supplier, setSupplier] = useState(lead.current_supplier ?? '')
  const [volume, setVolume] = useState<number | null>(volumeToOption(lead.monthly_matcha_usage_kg))
  const [price, setPrice] = useState(lead.current_delivered_price_per_kg?.toString() ?? '')
  const [painPoint, setPainPoint] = useState('')
  const [disqualReason, setDisqualReason] = useState('')

  // Section 2 — Contact Details
  const [contactPerson, setContactPerson] = useState(lead.contact_person ?? '')
  const [email, setEmail] = useState(lead.email ?? '')
  const [phone, setPhone] = useState(lead.phone ?? '')
  const [address, setAddress] = useState(lead.address ?? '')

  const contactRequired = mode === 'promote'
  const canSubmit = !contactRequired || contactPerson.trim().length > 0

  async function handleSubmit() {
    if (!canSubmit) return
    setSaving(true)
    setError(null)

    const patch: Record<string, unknown> = {
      serves_matcha: servesMatcha,
      matcha_interest_level: interestLevel || null,
      customer_bucket: bucket || null,
      current_supplier: supplier || null,
      monthly_matcha_usage_kg: volume,
      current_delivered_price_per_kg: price ? parseFloat(price) : null,
      contact_person: contactPerson || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
    }

    if (mode === 'disqualify') {
      patch.disqualification_reason = disqualReason || null
    }

    if (painPoint) {
      // Append pain point note to market_intel_notes
      const existing = lead.market_intel_notes ? lead.market_intel_notes + '\n' : ''
      patch.market_intel_notes = existing + `Interest reason: ${painPoint}`
    }

    try {
      const res = await fetch(`/api/leads/${lead.customer_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }
      onConfirm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {mode === 'promote' ? 'Promote Lead' : 'Disqualify Lead'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{lead.cafe_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Section 1 — Cafe Intelligence */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Cafe Intelligence</p>
            <div className="space-y-3">

              {/* Serves matcha */}
              <div>
                <label className="text-xs text-slate-600 block mb-1.5">Uses matcha currently?</label>
                <div className="flex gap-2">
                  {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map(({ label, value }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setServesMatcha(servesMatcha === value ? null : value)}
                      className={`px-3 py-1.5 text-xs rounded-md border font-medium transition-colors ${
                        servesMatcha === value
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interest level */}
              <div>
                <label className="text-xs text-slate-600 block mb-1.5">Matcha interest level</label>
                <select
                  value={interestLevel}
                  onChange={(e) => setInterestLevel(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                >
                  <option value="">— Select —</option>
                  {INTEREST_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              {/* Customer bucket */}
              <div>
                <label className="text-xs text-slate-600 block mb-1.5">Customer type</label>
                <div className="flex gap-2 flex-wrap">
                  {BUCKET_OPTIONS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBucket(bucket === b ? '' : b)}
                      className={`px-3 py-1.5 text-xs rounded-md border font-medium transition-colors ${
                        bucket === b
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Current supplier */}
              <div>
                <label className="text-xs text-slate-600 block mb-1.5">Current supplier</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="e.g. Encha, Ippodo, unknown"
                  className="w-full text-xs border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>

              {/* Monthly volume */}
              <div>
                <label className="text-xs text-slate-600 block mb-1.5">Monthly volume</label>
                <div className="flex gap-2 flex-wrap">
                  {VOLUME_OPTIONS.map(({ label, value }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setVolume(volume === value ? null : value)}
                      className={`px-3 py-1.5 text-xs rounded-md border font-medium transition-colors ${
                        volume === value
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Current price */}
              <div>
                <label className="text-xs text-slate-600 block mb-1.5">Price they pay ($/kg)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 45"
                  min={0}
                  className="w-full text-xs border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>

              {/* Pain point / interest reason */}
              <div>
                <label className="text-xs text-slate-600 block mb-1.5">Why they replied</label>
                <select
                  value={painPoint}
                  onChange={(e) => setPainPoint(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                >
                  <option value="">— Select —</option>
                  {PAIN_POINT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              {/* Disqualification reason (only in disqualify mode) */}
              {mode === 'disqualify' && (
                <div>
                  <label className="text-xs text-slate-600 block mb-1.5">Reason for disqualifying</label>
                  <div className="flex gap-2 flex-wrap">
                    {DISQUALIFY_REASONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setDisqualReason(disqualReason === r ? '' : r)}
                        className={`px-3 py-1.5 text-xs rounded-md border font-medium transition-colors ${
                          disqualReason === r
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* Section 2 — Contact Details */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Contact Details
              {!contactRequired && <span className="ml-1 font-normal normal-case text-slate-400">(optional)</span>}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-600 block mb-1.5">
                  Contact person{contactRequired && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Sarah Kim"
                  className={`w-full text-xs border rounded-md px-2.5 py-1.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 ${
                    contactRequired && !contactPerson.trim()
                      ? 'border-red-300 focus:ring-red-400'
                      : 'border-slate-300 focus:ring-slate-400'
                  }`}
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. sarah@cafe.com"
                  className="w-full text-xs border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +1 555 000 1234"
                  className="w-full text-xs border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1.5">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 123 Main St, Boston, MA 02101"
                  className="w-full text-xs border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 space-y-2">
          {error && <p className="text-xs text-red-600">{error}</p>}
          {contactRequired && !contactPerson.trim() && (
            <p className="text-xs text-red-500">Contact person name is required to promote.</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={saving || !canSubmit}
            className={`w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold rounded-md transition-all disabled:opacity-50 ${
              mode === 'promote'
                ? 'bg-green-600 text-white hover:bg-green-700 active:scale-[0.98]'
                : 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]'
            }`}
          >
            {saving
              ? 'Saving...'
              : mode === 'promote'
              ? 'Save & Promote →'
              : 'Save & Disqualify'}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
