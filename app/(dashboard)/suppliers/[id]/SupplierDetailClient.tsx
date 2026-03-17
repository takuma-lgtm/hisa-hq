'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Supplier, SupplierCommunication, SupplierProduct, SupplierMessageTemplate, SupplierStage, SupplierBusinessType, SampleTrackingStatus } from '@/types/database'
import { SUPPLIER_STAGE_LABELS, SUPPLIER_BUSINESS_TYPE_LABELS, SAMPLE_STATUS_LABELS } from '@/types/database'
import { SUPPLIER_STAGE_COLORS, SUPPLIER_STAGE_ORDER, SUPPLIER_BUSINESS_TYPE_COLORS, SAMPLE_STATUS_COLORS } from '@/lib/constants'
import { ArrowLeft, Send, ExternalLink, Phone, Mail, Globe, Handshake } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LinkedProduct extends SupplierProduct {
  product: { product_id: string; customer_facing_product_name: string; product_type: string | null } | null
}

interface SupplierDetailClientProps {
  supplier: Supplier
  communications: SupplierCommunication[]
  linkedProducts: LinkedProduct[]
  templates: SupplierMessageTemplate[]
  canEdit: boolean
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

export default function SupplierDetailClient({
  supplier: initialSupplier,
  communications: initialComms,
  linkedProducts,
  templates,
  canEdit,
}: SupplierDetailClientProps) {
  const router = useRouter()
  const [supplier, setSupplier] = useState(initialSupplier)
  const [comms, setComms] = useState(initialComms)
  const [activeTab, setActiveTab] = useState<'comms' | 'products'>('comms')

  // Editable fields
  const [name, setName] = useState(supplier.supplier_name)
  const [nameEn, setNameEn] = useState(supplier.supplier_name_en ?? '')
  const [contactPerson, setContactPerson] = useState(supplier.contact_person ?? '')
  const [email, setEmail] = useState(supplier.email ?? '')
  const [phone, setPhone] = useState(supplier.phone ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(supplier.website_url ?? '')
  const [prefecture, setPrefecture] = useState(supplier.prefecture ?? '')
  const [specialty, setSpecialty] = useState(supplier.specialty ?? '')
  const [memo, setMemo] = useState(supplier.memo ?? '')
  const [actionMemo, setActionMemo] = useState(supplier.action_memo ?? '')
  const [notes, setNotes] = useState(supplier.notes ?? '')
  const [stage, setStage] = useState<SupplierStage>(supplier.stage)
  const [businessType, setBusinessType] = useState<SupplierBusinessType | ''>(supplier.business_type ?? '')
  const [sampleStatus, setSampleStatus] = useState<SampleTrackingStatus>(supplier.sample_status)
  const [source, setSource] = useState(supplier.source ?? '')

  const [converting, setConverting] = useState(false)

  const CONVERTIBLE_STAGES: SupplierStage[] = ['inquiry_sent', 'met_at_event', 'in_communication', 'visit_scheduled', 'visited']
  const canConvert = canEdit && CONVERTIBLE_STAGES.includes(stage)

  async function handleConvert() {
    if (!confirm('この仕入れ先を取引成立に変更しますか？')) return
    setConverting(true)
    try {
      const res = await fetch(`/api/suppliers/${supplier.supplier_id}/convert`, { method: 'POST' })
      if (res.ok) {
        router.push(`/active-suppliers/${supplier.supplier_id}`)
      }
    } finally {
      setConverting(false)
    }
  }

  // Comm composer
  const [channel, setChannel] = useState('phone')
  const [messageBody, setMessageBody] = useState('')
  const [sending, setSending] = useState(false)

  async function saveField(field: string, value: unknown) {
    await fetch(`/api/suppliers/${supplier.supplier_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
  }

  async function handleSendComm() {
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
      }
    } finally {
      setSending(false)
    }
  }

  function applyTemplate(templateId: string) {
    const t = templates.find((t) => t.template_id === templateId)
    if (t) {
      setMessageBody(t.message_body)
      setChannel(t.channel)
    }
  }

  const EditField = ({ label, value, onChange, onBlur, type = 'text', rows }: {
    label: string; value: string; onChange: (v: string) => void; onBlur: () => void; type?: string; rows?: number
  }) => (
    <div>
      <label className="text-xs font-medium text-slate-500 block mb-1">{label}</label>
      {rows ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="w-full text-sm border border-slate-200 rounded px-3 py-1.5 resize-none"
          rows={rows}
          disabled={!canEdit}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="w-full text-sm border border-slate-200 rounded px-3 py-1.5"
          disabled={!canEdit}
        />
      )}
    </div>
  )

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/suppliers" className="p-1 hover:bg-slate-100 rounded">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">{supplier.supplier_name}</h1>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SUPPLIER_STAGE_COLORS[stage]}`}>
            {SUPPLIER_STAGE_LABELS[stage]}
          </span>
          {sampleStatus !== 'none' && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SAMPLE_STATUS_COLORS[sampleStatus]}`}>
              {SAMPLE_STATUS_LABELS[sampleStatus]}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between ml-8">
          {supplier.prefecture && (
            <p className="text-sm text-slate-500">{supplier.prefecture} · {supplier.country}</p>
          )}
          {canConvert && (
            <Button
              onClick={handleConvert}
              disabled={converting}
              className="bg-slate-800 hover:bg-slate-900 text-white text-sm gap-1.5"
            >
              <Handshake className="w-4 h-4" />
              {converting ? '変更中...' : '取引成立に変更'}
            </Button>
          )}
          {stage === 'deal_established' && (
            <Link href={`/active-suppliers/${supplier.supplier_id}`}
              className="text-sm text-green-700 hover:text-green-800 font-medium">
              Active Supplier Detail →
            </Link>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6 p-6">
        {/* Left column: info */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Stage + Type + Sample Status */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">ステータス</label>
              {canEdit ? (
                <select
                  value={stage}
                  onChange={(e) => { setStage(e.target.value as SupplierStage); saveField('stage', e.target.value) }}
                  className="w-full text-sm border border-slate-200 rounded px-3 py-1.5"
                >
                  {SUPPLIER_STAGE_ORDER.map((s) => (
                    <option key={s} value={s}>{SUPPLIER_STAGE_LABELS[s]}</option>
                  ))}
                </select>
              ) : (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SUPPLIER_STAGE_COLORS[stage]}`}>
                  {SUPPLIER_STAGE_LABELS[stage]}
                </span>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">業態区分</label>
              {canEdit ? (
                <select
                  value={businessType}
                  onChange={(e) => { setBusinessType(e.target.value as SupplierBusinessType | ''); saveField('business_type', e.target.value || null) }}
                  className="w-full text-sm border border-slate-200 rounded px-3 py-1.5"
                >
                  <option value="">—</option>
                  {(Object.entries(SUPPLIER_BUSINESS_TYPE_LABELS) as [SupplierBusinessType, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              ) : (
                <span className="text-sm text-slate-600">
                  {businessType ? SUPPLIER_BUSINESS_TYPE_LABELS[businessType as SupplierBusinessType] : '—'}
                </span>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">サンプル状況</label>
              {canEdit ? (
                <select
                  value={sampleStatus}
                  onChange={(e) => { setSampleStatus(e.target.value as SampleTrackingStatus); saveField('sample_status', e.target.value) }}
                  className="w-full text-sm border border-slate-200 rounded px-3 py-1.5"
                >
                  {(Object.entries(SAMPLE_STATUS_LABELS) as [SampleTrackingStatus, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              ) : (
                <span className="text-sm text-slate-600">{SAMPLE_STATUS_LABELS[sampleStatus]}</span>
              )}
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <EditField label="企業名" value={name} onChange={setName} onBlur={() => saveField('supplier_name', name)} />
            <EditField label="英語名" value={nameEn} onChange={setNameEn} onBlur={() => saveField('supplier_name_en', nameEn || null)} />
            <EditField label="担当者" value={contactPerson} onChange={setContactPerson} onBlur={() => saveField('contact_person', contactPerson || null)} />
            <EditField label="電話" value={phone} onChange={setPhone} onBlur={() => saveField('phone', phone || null)} />
            <EditField label="メール" value={email} onChange={setEmail} onBlur={() => saveField('email', email || null)} type="email" />
            <EditField label="ウェブサイト" value={websiteUrl} onChange={setWebsiteUrl} onBlur={() => saveField('website_url', websiteUrl || null)} type="url" />
            <EditField label="都道府県" value={prefecture} onChange={setPrefecture} onBlur={() => saveField('prefecture', prefecture || null)} />
            <EditField label="入り口" value={source} onChange={setSource} onBlur={() => saveField('source', source || null)} />
            <EditField label="取扱品目" value={specialty} onChange={setSpecialty} onBlur={() => saveField('specialty', specialty || null)} />
          </div>

          {/* Memo + Action Memo */}
          <div className="space-y-4">
            <EditField label="メモ" value={memo} onChange={setMemo} onBlur={() => saveField('memo', memo || null)} rows={3} />
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">アクションメモ</label>
              <textarea
                value={actionMemo}
                onChange={(e) => setActionMemo(e.target.value)}
                onBlur={() => saveField('action_memo', actionMemo || null)}
                className="w-full text-sm border border-amber-200 rounded px-3 py-1.5 resize-none bg-amber-50"
                rows={4}
                disabled={!canEdit}
                placeholder="次のアクションを入力..."
              />
            </div>
            <EditField label="ノート" value={notes} onChange={setNotes} onBlur={() => saveField('notes', notes || null)} rows={4} />
          </div>
        </div>

        {/* Right column: comms + products */}
        <div className="w-[400px] shrink-0 space-y-4">
          {/* Tab selector */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('comms')}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                activeTab === 'comms' ? 'border-green-700 text-green-700' : 'border-transparent text-slate-500'
              }`}
            >
              Communications ({comms.length})
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                activeTab === 'products' ? 'border-green-700 text-green-700' : 'border-transparent text-slate-500'
              }`}
            >
              Products ({linkedProducts.length})
            </button>
          </div>

          {activeTab === 'comms' && (
            <div className="space-y-4">
              {/* Composer */}
              {canEdit && (
                <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
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
                        onChange={(e) => { applyTemplate(e.target.value); e.target.value = '' }}
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
                      className="flex-1 text-sm border border-slate-200 rounded px-3 py-1.5 resize-none"
                      rows={3}
                      placeholder="コミュニケーション内容..."
                    />
                    <button
                      onClick={handleSendComm}
                      disabled={sending || !messageBody.trim()}
                      className="self-end p-2 bg-slate-800 text-white rounded hover:bg-slate-900 disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* History */}
              {comms.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">まだ記録がありません</p>
              ) : (
                <div className="space-y-3">
                  {comms.map((c) => (
                    <div key={c.comm_id} className="border-l-2 border-slate-200 pl-3 py-1">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="font-medium text-slate-600">
                          {CHANNEL_OPTIONS.find((o) => o.value === c.channel)?.label ?? c.channel}
                        </span>
                        <span>{c.direction === 'inbound' ? '← 受信' : '→ 送信'}</span>
                        <span>{new Date(c.created_at).toLocaleDateString('ja-JP')}</span>
                      </div>
                      {c.message_body && (
                        <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{c.message_body}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'products' && (
            <div>
              {linkedProducts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No products linked</p>
              ) : (
                <div className="space-y-2">
                  {linkedProducts.map((lp) => (
                    <div key={lp.id} className="border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {lp.product?.customer_facing_product_name ?? lp.product_name_jpn ?? 'Unknown'}
                          </p>
                          {lp.product?.product_type && (
                            <span className="text-[10px] text-slate-500">{lp.product.product_type}</span>
                          )}
                        </div>
                        {lp.is_primary && (
                          <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium">Primary</span>
                        )}
                      </div>
                      <div className="flex gap-4 mt-1 text-xs text-slate-500">
                        {lp.cost_per_kg_jpy != null && <span>¥{lp.cost_per_kg_jpy.toLocaleString()}/kg</span>}
                        {lp.moq_kg != null && <span>MOQ: {lp.moq_kg}kg</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
