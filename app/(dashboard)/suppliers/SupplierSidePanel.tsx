'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { Supplier, SupplierStage, SupplierBusinessType, SampleTrackingStatus, SupplierMessageTemplate } from '@/types/database'
import { SUPPLIER_STAGE_LABELS, SUPPLIER_BUSINESS_TYPE_LABELS, SAMPLE_STATUS_LABELS } from '@/types/database'
import { SUPPLIER_STAGE_COLORS, SUPPLIER_STAGE_ORDER, SUPPLIER_BUSINESS_TYPE_COLORS, SAMPLE_STATUS_COLORS } from '@/lib/constants'
import { X, ExternalLink, Send } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommLog {
  comm_id: string
  channel: string
  direction: string
  subject: string | null
  message_body: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

interface SupplierSidePanelProps {
  supplier: Supplier
  canEdit: boolean
  commCount: number
  onClose: () => void
  onDataChanged: () => void
  onSupplierUpdated?: (supplierId: string, updates: Partial<Supplier>) => void
}

const CHANNEL_OPTIONS = [
  { value: 'phone', label: '電話' },
  { value: 'email', label: 'メール' },
  { value: 'inquiry_form', label: '問い合わせフォーム' },
  { value: 'line', label: 'LINE' },
  { value: 'imessage', label: 'iMessage' },
  { value: 'in_person', label: '対面' },
  { value: 'trade_show', label: '展示会' },
]

const BUSINESS_TYPE_OPTIONS: { value: SupplierBusinessType; label: string }[] = [
  { value: 'tea_wholesaler', label: SUPPLIER_BUSINESS_TYPE_LABELS.tea_wholesaler },
  { value: 'farm', label: SUPPLIER_BUSINESS_TYPE_LABELS.farm },
  { value: 'broker', label: SUPPLIER_BUSINESS_TYPE_LABELS.broker },
  { value: 'other', label: SUPPLIER_BUSINESS_TYPE_LABELS.other },
]

const SAMPLE_STATUS_OPTIONS: { value: SampleTrackingStatus; label: string }[] = [
  { value: 'none', label: SAMPLE_STATUS_LABELS.none },
  { value: 'waiting', label: SAMPLE_STATUS_LABELS.waiting },
  { value: 'received', label: SAMPLE_STATUS_LABELS.received },
  { value: 'evaluated', label: SAMPLE_STATUS_LABELS.evaluated },
]

// ---------------------------------------------------------------------------
// Inline Editable Field (click to edit, save on blur/Enter, Escape cancels)
// ---------------------------------------------------------------------------

function InlineField({
  label,
  value,
  field,
  canEdit,
  onSave,
}: {
  label: string
  value: string | null
  field: string
  canEdit: boolean
  onSave: (field: string, value: string | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync draft from prop
    setDraft(value ?? '')
    setEditing(false)
  }, [value])

  async function save() {
    const trimmed = draft.trim() || null
    if (trimmed === (value ?? null)) {
      setEditing(false)
      return
    }
    setSaving(true)
    await onSave(field, trimmed)
    setSaving(false)
    setEditing(false)
  }

  if (!canEdit) {
    return (
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-[10px] text-slate-400 w-16 shrink-0">{label}</span>
        <span className="text-xs text-slate-600 truncate">{value || '—'}</span>
      </div>
    )
  }

  if (!editing) {
    return (
      <div
        className="flex items-center gap-2 py-0.5 cursor-pointer group"
        onClick={() => setEditing(true)}
      >
        <span className="text-[10px] text-slate-400 w-16 shrink-0">{label}</span>
        <span className="text-xs text-slate-600 truncate group-hover:bg-green-50/50 rounded px-1 -mx-1 transition-colors">
          {value || <span className="text-slate-300 italic">クリックして入力...</span>}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-[10px] text-slate-400 w-16 shrink-0">{label}</span>
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
        }}
        className="flex-1 text-xs border border-green-300 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-green-500"
        disabled={saving}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SupplierSidePanel({
  supplier,
  canEdit,
  commCount,
  onClose,
  onDataChanged,
  onSupplierUpdated,
}: SupplierSidePanelProps) {
  const [localStage, setLocalStage] = useState<SupplierStage>(supplier.stage)
  const [localBusinessType, setLocalBusinessType] = useState<SupplierBusinessType | null>(supplier.business_type)
  const [localSampleStatus, setLocalSampleStatus] = useState<SampleTrackingStatus>(supplier.sample_status)
  const [localMemo, setLocalMemo] = useState(supplier.memo ?? '')
  const [localActionMemo, setLocalActionMemo] = useState(supplier.action_memo ?? '')
  const [comms, setComms] = useState<CommLog[]>([])
  const [loadingComms, setLoadingComms] = useState(true)
  const [channel, setChannel] = useState('phone')
  const [messageBody, setMessageBody] = useState('')
  const [sending, setSending] = useState(false)
  const [templates, setTemplates] = useState<SupplierMessageTemplate[]>([])
  const prevSupplierId = useRef(supplier.supplier_id)

  // Reset local state when supplier changes
  useEffect(() => {
    if (prevSupplierId.current !== supplier.supplier_id) {
      setLocalStage(supplier.stage)
      setLocalBusinessType(supplier.business_type)
      setLocalSampleStatus(supplier.sample_status)
      setLocalMemo(supplier.memo ?? '')
      setLocalActionMemo(supplier.action_memo ?? '')
      setMessageBody('')
      prevSupplierId.current = supplier.supplier_id
    }
  }, [supplier])

  // Fetch comms and templates
  useEffect(() => {
    setLoadingComms(true)
    Promise.all([
      fetch(`/api/suppliers/${supplier.supplier_id}/communications`).then((r) => r.json()),
      fetch('/api/suppliers/templates').then((r) => r.json()),
    ]).then(([commsData, templatesData]) => {
      setComms(Array.isArray(commsData) ? commsData : [])
      setTemplates(Array.isArray(templatesData) ? templatesData : [])
      setLoadingComms(false)
    })
  }, [supplier.supplier_id])

  async function saveField(field: string, value: unknown) {
    await fetch(`/api/suppliers/${supplier.supplier_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    onSupplierUpdated?.(supplier.supplier_id, { [field]: value } as Partial<Supplier>)
  }

  async function handleStageChange(newStage: SupplierStage) {
    setLocalStage(newStage)
    await saveField('stage', newStage)
  }

  async function handleBusinessTypeChange(newType: string) {
    const val = (newType || null) as SupplierBusinessType | null
    setLocalBusinessType(val)
    await saveField('business_type', val)
  }

  async function handleSampleStatusChange(newStatus: SampleTrackingStatus) {
    setLocalSampleStatus(newStatus)
    await saveField('sample_status', newStatus)
  }

  async function handleSendMessage() {
    if (!messageBody.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/suppliers/${supplier.supplier_id}/communications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, message_body: messageBody }),
      })
      if (res.ok) {
        const newComm = await res.json()
        setComms((prev) => [newComm, ...prev])
        setMessageBody('')
        onDataChanged()
      }
    } finally {
      setSending(false)
    }
  }

  function applyTemplate(template: SupplierMessageTemplate) {
    setMessageBody(template.message_body)
    setChannel(template.channel)
  }

  const relativeDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return '今日'
    if (days === 1) return '昨日'
    if (days < 7) return `${days}日前`
    if (days < 30) return `${Math.floor(days / 7)}週間前`
    return d.toLocaleDateString('ja-JP')
  }

  // Wrapper for InlineField's onSave
  async function handleInlineSave(field: string, value: string | null) {
    await saveField(field, value)
  }

  return (
    <div className="w-[400px] shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
      {/* Header — editable name */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-start justify-between">
        <div className="min-w-0 flex-1 mr-2">
          <InlineField label="" value={supplier.supplier_name} field="supplier_name" canEdit={canEdit} onSave={handleInlineSave} />
          <InlineField label="" value={supplier.supplier_name_en} field="supplier_name_en" canEdit={canEdit} onSave={handleInlineSave} />
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded mt-0.5">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Stage + Business Type + Sample Status */}
        <div className="px-4 py-3 border-b border-slate-100 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-slate-400 w-16 shrink-0">ステータス</label>
            {canEdit ? (
              <select
                value={localStage}
                onChange={(e) => handleStageChange(e.target.value as SupplierStage)}
                className="text-xs border border-slate-200 rounded px-2 py-1 flex-1"
              >
                {SUPPLIER_STAGE_ORDER.map((s) => (
                  <option key={s} value={s}>{SUPPLIER_STAGE_LABELS[s]}</option>
                ))}
              </select>
            ) : (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SUPPLIER_STAGE_COLORS[localStage]}`}>
                {SUPPLIER_STAGE_LABELS[localStage]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-slate-400 w-16 shrink-0">業態区分</label>
            {canEdit ? (
              <select
                value={localBusinessType ?? ''}
                onChange={(e) => handleBusinessTypeChange(e.target.value)}
                className="text-xs border border-slate-200 rounded px-2 py-1 flex-1"
              >
                <option value="">—</option>
                {BUSINESS_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              localBusinessType ? (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SUPPLIER_BUSINESS_TYPE_COLORS[localBusinessType]}`}>
                  {SUPPLIER_BUSINESS_TYPE_LABELS[localBusinessType]}
                </span>
              ) : (
                <span className="text-xs text-slate-400">—</span>
              )
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-slate-400 w-16 shrink-0">サンプル</label>
            {canEdit ? (
              <select
                value={localSampleStatus}
                onChange={(e) => handleSampleStatusChange(e.target.value as SampleTrackingStatus)}
                className="text-xs border border-slate-200 rounded px-2 py-1 flex-1"
              >
                {SAMPLE_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              localSampleStatus !== 'none' ? (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SAMPLE_STATUS_COLORS[localSampleStatus]}`}>
                  {SAMPLE_STATUS_LABELS[localSampleStatus]}
                </span>
              ) : (
                <span className="text-xs text-slate-400">—</span>
              )
            )}
          </div>
        </div>

        {/* Contact Info — inline editable */}
        <div className="px-4 py-3 border-b border-slate-100 space-y-0.5">
          <label className="text-[10px] font-medium text-slate-500 mb-1 block">連絡先</label>
          <InlineField label="担当" value={supplier.contact_person} field="contact_person" canEdit={canEdit} onSave={handleInlineSave} />
          <InlineField label="電話" value={supplier.phone} field="phone" canEdit={canEdit} onSave={handleInlineSave} />
          <InlineField label="メール" value={supplier.email} field="email" canEdit={canEdit} onSave={handleInlineSave} />
          <InlineField label="Web" value={supplier.website_url} field="website_url" canEdit={canEdit} onSave={handleInlineSave} />
          {supplier.website_url && (
            <a href={supplier.website_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-green-700 hover:underline ml-[72px]">
              <ExternalLink className="w-2.5 h-2.5" />開く
            </a>
          )}
        </div>

        {/* Details — inline editable */}
        <div className="px-4 py-3 border-b border-slate-100 space-y-0.5">
          <label className="text-[10px] font-medium text-slate-500 mb-1 block">詳細</label>
          <InlineField label="都道府県" value={supplier.prefecture} field="prefecture" canEdit={canEdit} onSave={handleInlineSave} />
          <InlineField label="入り口" value={supplier.source} field="source" canEdit={canEdit} onSave={handleInlineSave} />
          <InlineField label="取扱品目" value={supplier.specialty} field="specialty" canEdit={canEdit} onSave={handleInlineSave} />
        </div>

        {/* Memo */}
        <div className="px-4 py-3 border-b border-slate-100">
          <label className="text-xs font-medium text-slate-500 mb-1 block">メモ</label>
          {canEdit ? (
            <textarea
              value={localMemo}
              onChange={(e) => setLocalMemo(e.target.value)}
              onBlur={() => saveField('memo', localMemo || null)}
              className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 resize-none"
              rows={2}
              placeholder="メモを入力..."
            />
          ) : (
            <p className="text-xs text-slate-600 whitespace-pre-wrap">{supplier.memo || '—'}</p>
          )}
        </div>

        {/* Action Memo */}
        <div className="px-4 py-3 border-b border-slate-100">
          <label className="text-xs font-medium text-slate-500 mb-1 block">アクションメモ</label>
          {canEdit ? (
            <textarea
              value={localActionMemo}
              onChange={(e) => setLocalActionMemo(e.target.value)}
              onBlur={() => saveField('action_memo', localActionMemo || null)}
              className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 resize-none bg-amber-50"
              rows={3}
              placeholder="次のアクションを入力..."
            />
          ) : (
            <p className="text-xs text-slate-600 whitespace-pre-wrap">{supplier.action_memo || '—'}</p>
          )}
        </div>

        {/* Communication Composer */}
        {canEdit && (
          <div className="px-4 py-3 border-b border-slate-100">
            <label className="text-xs font-medium text-slate-500 mb-2 block">コミュニケーション記録</label>
            <div className="flex items-center gap-2 mb-2">
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="text-xs border border-slate-200 rounded px-2 py-1"
              >
                {CHANNEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {templates.length > 0 && (
                <select
                  onChange={(e) => {
                    const t = templates.find((t) => t.template_id === e.target.value)
                    if (t) applyTemplate(t)
                    e.target.value = ''
                  }}
                  className="text-xs border border-slate-200 rounded px-2 py-1 text-slate-400"
                  defaultValue=""
                >
                  <option value="" disabled>テンプレート</option>
                  {templates.map((t) => (
                    <option key={t.template_id} value={t.template_id}>{t.template_name}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex gap-2">
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5 resize-none"
                rows={2}
                placeholder="内容を入力..."
              />
              <button
                onClick={handleSendMessage}
                disabled={sending || !messageBody.trim()}
                className="self-end p-2 bg-green-700 text-white rounded hover:bg-green-800 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Communication History */}
        <div className="px-4 py-3">
          <label className="text-xs font-medium text-slate-500 mb-2 block">
            コミュニケーション履歴 ({commCount + comms.length > commCount ? comms.length : commCount})
          </label>
          {loadingComms ? (
            <p className="text-xs text-slate-400">読み込み中...</p>
          ) : comms.length === 0 ? (
            <p className="text-xs text-slate-400">まだ記録がありません</p>
          ) : (
            <div className="space-y-2">
              {comms.slice(0, 10).map((c) => (
                <div key={c.comm_id} className="border-l-2 border-slate-200 pl-3 py-1">
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="font-medium text-slate-600">
                      {CHANNEL_OPTIONS.find((o) => o.value === c.channel)?.label ?? c.channel}
                    </span>
                    <span>{c.direction === 'inbound' ? '←' : '→'}</span>
                    <span>{relativeDate(c.created_at)}</span>
                  </div>
                  {c.message_body && (
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{c.message_body}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-200">
        <Link
          href={`/suppliers/${supplier.supplier_id}`}
          className="text-xs text-green-700 hover:text-green-800 font-medium"
        >
          Open Full Detail →
        </Link>
      </div>
    </div>
  )
}
