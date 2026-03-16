'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { Supplier, SupplierStage, SupplierBusinessType, SampleTrackingStatus, SupplierMessageTemplate } from '@/types/database'
import { SUPPLIER_STAGE_LABELS, SUPPLIER_BUSINESS_TYPE_LABELS, SAMPLE_STATUS_LABELS } from '@/types/database'
import { SUPPLIER_STAGE_COLORS, SUPPLIER_STAGE_ORDER, SUPPLIER_BUSINESS_TYPE_COLORS, SAMPLE_STATUS_COLORS } from '@/lib/constants'
import { X, ExternalLink, Phone, Mail, Send } from 'lucide-react'

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

export default function SupplierSidePanel({
  supplier,
  canEdit,
  commCount,
  onClose,
  onDataChanged,
  onSupplierUpdated,
}: SupplierSidePanelProps) {
  const [localStage, setLocalStage] = useState<SupplierStage>(supplier.stage)
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

  return (
    <div className="w-[400px] shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 truncate">{supplier.supplier_name}</h3>
          <div className="flex items-center gap-2 mt-1">
            {supplier.prefecture && (
              <span className="text-xs text-slate-500">{supplier.prefecture}</span>
            )}
            {supplier.business_type && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${SUPPLIER_BUSINESS_TYPE_COLORS[supplier.business_type]}`}>
                {SUPPLIER_BUSINESS_TYPE_LABELS[supplier.business_type]}
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Stage + Sample Status */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-slate-500 w-16">ステータス</label>
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
          {supplier.sample_status !== 'none' && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 w-16">サンプル</label>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SAMPLE_STATUS_COLORS[supplier.sample_status]}`}>
                {SAMPLE_STATUS_LABELS[supplier.sample_status]}
              </span>
            </div>
          )}
        </div>

        {/* Contact Info */}
        <div className="px-4 py-3 border-b border-slate-100 space-y-1.5">
          {supplier.contact_person && (
            <div className="text-xs text-slate-600">担当: {supplier.contact_person}</div>
          )}
          {supplier.phone && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Phone className="w-3 h-3" />{supplier.phone}
            </div>
          )}
          {supplier.email && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Mail className="w-3 h-3" />{supplier.email}
            </div>
          )}
          {supplier.website_url && (
            <a href={supplier.website_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-green-700 hover:underline">
              <ExternalLink className="w-3 h-3" />Website
            </a>
          )}
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
