'use client'

import { useState } from 'react'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { handoffProgress, isHandoffReady } from '@/lib/handoff'
import {
  CAFE_SEGMENT_LABELS,
  MATCHA_EXPERIENCE_LABELS,
} from '@/lib/constants'
import type { Customer, UserRole, CafeSegment, MatchaExperience } from '@/types/database'

interface Props {
  customer: Customer
  opportunityId: string
  userRole: UserRole
  onCustomerUpdate: (c: Customer) => void
}

interface FieldProps {
  label: string
  value: string | number | null | undefined
  onSave: (v: string) => Promise<void>
  type?: 'text' | 'number' | 'email' | 'tel'
  placeholder?: string
  required?: boolean
}

function InlineField({ label, value, onSave, type = 'text', placeholder, required }: FieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? ''))
  const [saving, setSaving] = useState(false)

  async function save() {
    if (draft === String(value ?? '')) { setEditing(false); return }
    setSaving(true)
    await onSave(draft)
    setSaving(false)
    setEditing(false)
  }

  const empty = !value && value !== 0

  if (editing) {
    return (
      <div className="mb-2">
        <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">
          {label}
        </label>
        <input
          autoFocus
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          className="w-full text-sm border border-green-400 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500"
          disabled={saving}
        />
      </div>
    )
  }

  return (
    <div
      className="mb-2 group cursor-pointer"
      onClick={() => { setDraft(String(value ?? '')); setEditing(true) }}
    >
      <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <p className={`text-sm rounded px-2 py-0.5 -mx-2 group-hover:bg-gray-100 transition-colors ${empty ? 'text-gray-400 italic' : 'text-gray-900'}`}>
        {empty ? placeholder ?? 'Click to add…' : String(value)}
      </p>
    </div>
  )
}

interface SelectFieldProps<T extends string> {
  label: string
  value: T | null | undefined
  options: Record<T, string>
  onSave: (v: T) => Promise<void>
  required?: boolean
}

function InlineSelect<T extends string>({ label, value, options, onSave, required }: SelectFieldProps<T>) {
  const [editing, setEditing] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setEditing(false)
    if (e.target.value) await onSave(e.target.value as T)
  }

  return (
    <div className="mb-2 group cursor-pointer" onClick={() => setEditing(true)}>
      <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {editing ? (
        <select
          autoFocus
          defaultValue={value ?? ''}
          onChange={handleChange}
          onBlur={() => setEditing(false)}
          className="w-full text-sm border border-green-400 rounded px-2 py-1 focus:outline-none"
        >
          <option value="">Select…</option>
          {(Object.entries(options) as [T, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      ) : (
        <p className={`text-sm rounded px-2 py-0.5 -mx-2 group-hover:bg-gray-100 transition-colors ${!value ? 'text-gray-400 italic' : 'text-gray-900'}`}>
          {value ? options[value] : 'Click to select…'}
        </p>
      )}
    </div>
  )
}

export default function QualificationPanel({ customer, userRole, onCustomerUpdate }: Props) {
  const supabase = createClient()
  const { completed, total } = handoffProgress(customer)
  const ready = isHandoffReady(customer)

  async function updateCustomer(fields: Partial<Customer>) {
    const { data } = await supabase
      .from('customers')
      .update(fields)
      .eq('customer_id', customer.customer_id)
      .select()
      .single()
    if (data) onCustomerUpdate(data as Customer)
  }

  const field = (key: keyof Customer, label: string, opts?: Partial<FieldProps>) => (
    <InlineField
      label={label}
      value={customer[key] as string | number | null}
      onSave={(v) => updateCustomer({ [key]: v || null })}
      {...opts}
    />
  )

  return (
    <div className="p-4">
      {/* Handoff progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-600">Handoff readiness</span>
          <span className="text-xs text-gray-500">{completed}/{total}</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${ready ? 'bg-green-500' : 'bg-amber-400'}`}
            style={{ width: `${(completed / total) * 100}%` }}
          />
        </div>
        {ready ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 rounded-lg px-2 py-1.5">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            Ready for handoff
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {total - completed} fields required before handoff
          </div>
        )}
      </div>

      {/* Cafe Basics */}
      <Section title="Cafe Basics">
        {field('cafe_name', 'Cafe Name', { required: true })}
        {field('instagram_handle', 'Instagram', { placeholder: '@handle', required: true })}
        {field('contact_person', 'Point of Contact', { required: true })}
        {field('phone', 'Phone', { type: 'tel', required: true })}
        {field('email', 'Email', { type: 'email' })}
        {field('address', 'Street Address', { required: true })}
        {field('city', 'City', { required: true })}
        {field('state', 'State', { required: true })}
        {field('zip_code', 'ZIP Code', { required: true })}
        {field('country', 'Country', { required: true })}
      </Section>

      {/* Demand */}
      <Section title="Demand">
        {field('monthly_matcha_usage_kg', 'Est. Monthly Usage (kg)', { type: 'number', required: true })}
        {field('budget_delivered_price_per_kg', 'Budget Delivered Price/kg', { type: 'number', required: true })}
        {field('budget_currency', 'Currency')}
      </Section>

      {/* Cafe Segment */}
      <Section title="Cafe Segment">
        <InlineSelect
          label="Cafe Type"
          value={customer.cafe_segment}
          options={CAFE_SEGMENT_LABELS}
          onSave={(v: CafeSegment) => updateCustomer({ cafe_segment: v })}
          required
        />
        <InlineSelect
          label="Matcha Experience"
          value={customer.matcha_experience}
          options={MATCHA_EXPERIENCE_LABELS}
          onSave={(v: MatchaExperience) => updateCustomer({ matcha_experience: v })}
          required
        />
      </Section>

      {/* Market Intel */}
      <Section title="Market Intelligence">
        <div className="mb-2">
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">
            Current Supplier<span className="text-red-400 ml-0.5">*</span>
          </label>
          <div className="flex items-center gap-2">
            <InlineField
              label=""
              value={customer.current_supplier}
              onSave={(v) => updateCustomer({ current_supplier: v || null })}
              placeholder="Supplier name"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-500 mt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={customer.current_supplier_unknown}
              onChange={(e) => updateCustomer({ current_supplier_unknown: e.target.checked })}
              className="rounded"
            />
            Unknown
          </label>
        </div>
        {field('current_delivered_price_per_kg', 'Current Price/kg (delivered)', { type: 'number' })}
        <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={customer.current_price_unknown}
            onChange={(e) => updateCustomer({ current_price_unknown: e.target.checked })}
            className="rounded"
          />
          Price unknown
        </label>
        {field('likes_about_current', 'What they like about current matcha')}
        {field('dislikes_about_current', 'What they dislike')}
        {field('why_switch', 'Why they want to switch')}
        {field('definition_of_good_matcha', 'Definition of good matcha')}
        {field('market_intel_notes', 'Additional notes')}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 pb-1 border-b border-gray-100">
        {title}
      </h3>
      {children}
    </div>
  )
}
