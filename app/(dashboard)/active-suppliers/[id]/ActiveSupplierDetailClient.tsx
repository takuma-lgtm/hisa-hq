'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type {
  Supplier, SupplierCommunication, SupplierProduct,
  SupplierPurchaseOrder, SupplierPurchaseOrderItem,
  SupplierMessageTemplate,
} from '@/types/database'
import { SUPPLIER_BUSINESS_TYPE_LABELS, SAMPLE_STATUS_LABELS } from '@/types/database'
import { SUPPLIER_BUSINESS_TYPE_COLORS } from '@/lib/constants'
import { ArrowLeft, Send, Plus, Package, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface OrderWithItems extends SupplierPurchaseOrder {
  items: SupplierPurchaseOrderItem[]
}

interface LinkedProduct extends SupplierProduct {
  product: { product_id: string; customer_facing_product_name: string; product_type: string | null } | null
}

interface Props {
  supplier: Supplier
  orders: OrderWithItems[]
  communications: SupplierCommunication[]
  linkedProducts: LinkedProduct[]
  templates: SupplierMessageTemplate[]
  allProducts: { product_id: string; customer_facing_product_name: string }[]
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

const DELIVERY_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  shipped: 'bg-blue-50 text-blue-700',
  delivered: 'bg-green-50 text-green-700',
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  unpaid: 'bg-red-50 text-red-600',
  partial: 'bg-amber-50 text-amber-700',
  paid: 'bg-green-50 text-green-700',
}

export default function ActiveSupplierDetailClient({
  supplier,
  orders: initialOrders,
  communications: initialComms,
  linkedProducts,
  templates,
  allProducts,
  canEdit,
}: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'comms' | 'products'>('overview')
  const [orders, setOrders] = useState(initialOrders)
  const [comms, setComms] = useState(initialComms)
  const [qualityRating, setQualityRating] = useState(supplier.quality_rating)
  const [reliabilityRating, setReliabilityRating] = useState(supplier.reliability_rating)

  // Comm composer state
  const [channel, setChannel] = useState('phone')
  const [messageBody, setMessageBody] = useState('')
  const [sending, setSending] = useState(false)

  // New order modal state
  const [orderModalOpen, setOrderModalOpen] = useState(false)
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [expectedDelivery, setExpectedDelivery] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [orderItems, setOrderItems] = useState<{ product_id: string; product_name_jpn: string; quantity_kg: string; price_per_kg_jpy: string }[]>([
    { product_id: '', product_name_jpn: '', quantity_kg: '', price_per_kg_jpy: '' },
  ])
  const [savingOrder, setSavingOrder] = useState(false)

  // Expanded PO row
  const [expandedPo, setExpandedPo] = useState<string | null>(null)

  const totalSpend = orders.reduce((sum, o) => sum + (o.total_amount_jpy ?? 0), 0)
  const avgQuality = orders.filter((o) => o.quality_rating).length > 0
    ? orders.filter((o) => o.quality_rating).reduce((s, o) => s + (o.quality_rating ?? 0), 0) /
      orders.filter((o) => o.quality_rating).length
    : null

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

  async function handleCreateOrder() {
    const validItems = orderItems.filter((i) => i.quantity_kg && i.price_per_kg_jpy)
    if (validItems.length === 0) return
    setSavingOrder(true)
    try {
      const res = await fetch(`/api/suppliers/${supplier.supplier_id}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_date: orderDate,
          expected_delivery: expectedDelivery || null,
          notes: orderNotes || null,
          items: validItems.map((i) => ({
            product_id: i.product_id || null,
            product_name_jpn: i.product_name_jpn || null,
            quantity_kg: parseFloat(i.quantity_kg),
            price_per_kg_jpy: parseFloat(i.price_per_kg_jpy),
          })),
        }),
      })
      if (res.ok) {
        const newOrder = await res.json()
        setOrders((prev) => [newOrder, ...prev])
        setOrderModalOpen(false)
        setOrderItems([{ product_id: '', product_name_jpn: '', quantity_kg: '', price_per_kg_jpy: '' }])
        setOrderNotes('')
      }
    } finally {
      setSavingOrder(false)
    }
  }

  function addOrderItem() {
    setOrderItems((prev) => [...prev, { product_id: '', product_name_jpn: '', quantity_kg: '', price_per_kg_jpy: '' }])
  }

  function removeOrderItem(idx: number) {
    setOrderItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateOrderItem(idx: number, field: string, value: string) {
    setOrderItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const renderStars = (rating: number | null, onChange?: (v: number) => void) => {
    const r = rating ?? 0
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => onChange?.(star)}
            disabled={!onChange}
            className={`text-lg ${star <= r ? 'text-amber-500' : 'text-slate-200'} ${onChange ? 'cursor-pointer hover:text-amber-400' : ''}`}
          >
            ★
          </button>
        ))}
      </div>
    )
  }

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('ja-JP') : '—'
  const formatCurrency = (n: number) => `¥${Math.round(n).toLocaleString()}`

  // Merged timeline for overview
  const timelineItems = [
    ...orders.map((o) => ({
      type: 'order' as const,
      date: o.order_date,
      data: o,
    })),
    ...comms.map((c) => ({
      type: 'comm' as const,
      date: c.created_at,
      data: c,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const tabs = [
    { key: 'overview' as const, label: '概要' },
    { key: 'orders' as const, label: `発注履歴 (${orders.length})` },
    { key: 'comms' as const, label: `やりとり (${comms.length})` },
    { key: 'products' as const, label: `取扱商品 (${linkedProducts.length})` },
  ]

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/active-suppliers" className="p-1 hover:bg-slate-100 rounded">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">{supplier.supplier_name}</h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
            取引成立
          </span>
          {supplier.business_type && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${SUPPLIER_BUSINESS_TYPE_COLORS[supplier.business_type]}`}>
              {SUPPLIER_BUSINESS_TYPE_LABELS[supplier.business_type]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-6 ml-8">
          {supplier.prefecture && <span className="text-sm text-slate-500">{supplier.prefecture}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-slate-200 flex">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {/* ===== OVERVIEW TAB ===== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-400 mb-1">合計仕入額</p>
                <p className="text-lg font-semibold text-slate-900">{totalSpend > 0 ? formatCurrency(totalSpend) : '—'}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-400 mb-1">発注回数</p>
                <p className="text-lg font-semibold text-slate-900">{orders.length}回</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-400 mb-1">取扱商品数</p>
                <p className="text-lg font-semibold text-slate-900">{linkedProducts.length}</p>
              </div>
            </div>

            {/* Merged timeline */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3">アクティビティ</h3>
              {timelineItems.length === 0 ? (
                <p className="text-sm text-slate-400">まだアクティビティがありません</p>
              ) : (
                <div className="space-y-3">
                  {timelineItems.slice(0, 20).map((item, idx) => (
                    <div key={idx} className="flex gap-3 items-start">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm ${
                        item.type === 'order' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.type === 'order' ? '📦' : '💬'}
                      </div>
                      <div className="flex-1 min-w-0">
                        {item.type === 'order' ? (
                          <>
                            <p className="text-sm text-slate-900">
                              <span className="font-medium">{(item.data as OrderWithItems).po_number}</span>
                              {' — '}
                              {formatCurrency((item.data as OrderWithItems).total_amount_jpy ?? 0)}
                            </p>
                            <p className="text-xs text-slate-400">{formatDate(item.date)}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-slate-600 line-clamp-2">
                              {(item.data as SupplierCommunication).message_body ?? 'Communication logged'}
                            </p>
                            <p className="text-xs text-slate-400">
                              {CHANNEL_OPTIONS.find((o) => o.value === (item.data as SupplierCommunication).channel)?.label}
                              {' · '}{formatDate(item.date)}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== ORDERS TAB ===== */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {canEdit && (
              <div className="flex justify-end">
                <Dialog open={orderModalOpen} onOpenChange={setOrderModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-slate-800 hover:bg-slate-900 text-white text-sm gap-1.5">
                      <Plus className="w-4 h-4" />New Order
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>新しい発注</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-slate-600 block mb-1">発注日</label>
                          <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)}
                            className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600 block mb-1">納品予定日</label>
                          <input type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)}
                            className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm" />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">明細</label>
                        <div className="space-y-2">
                          {orderItems.map((item, idx) => (
                            <div key={idx} className="flex gap-2 items-end">
                              <div className="flex-1">
                                <select
                                  value={item.product_id}
                                  onChange={(e) => {
                                    updateOrderItem(idx, 'product_id', e.target.value)
                                    const p = allProducts.find((p) => p.product_id === e.target.value)
                                    if (p) updateOrderItem(idx, 'product_name_jpn', p.customer_facing_product_name)
                                  }}
                                  className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs"
                                >
                                  <option value="">商品を選択</option>
                                  {allProducts.map((p) => (
                                    <option key={p.product_id} value={p.product_id}>{p.customer_facing_product_name}</option>
                                  ))}
                                </select>
                              </div>
                              <input
                                type="number" placeholder="kg" value={item.quantity_kg}
                                onChange={(e) => updateOrderItem(idx, 'quantity_kg', e.target.value)}
                                className="w-20 border border-slate-200 rounded px-2 py-1.5 text-xs"
                              />
                              <input
                                type="number" placeholder="¥/kg" value={item.price_per_kg_jpy}
                                onChange={(e) => updateOrderItem(idx, 'price_per_kg_jpy', e.target.value)}
                                className="w-24 border border-slate-200 rounded px-2 py-1.5 text-xs"
                              />
                              {orderItems.length > 1 && (
                                <button onClick={() => removeOrderItem(idx)} className="p-1 text-slate-400 hover:text-red-500">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button onClick={addOrderItem} className="text-xs text-slate-700 hover:text-slate-800">+ 明細を追加</button>
                        </div>
                      </div>

                      {/* Total preview */}
                      {orderItems.some((i) => i.quantity_kg && i.price_per_kg_jpy) && (
                        <div className="text-right text-sm font-medium text-slate-900">
                          合計: {formatCurrency(orderItems.reduce((sum, i) =>
                            sum + (parseFloat(i.quantity_kg) || 0) * (parseFloat(i.price_per_kg_jpy) || 0), 0))}
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">備考</label>
                        <textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)}
                          className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm resize-none" rows={2} />
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setOrderModalOpen(false)}>キャンセル</Button>
                        <Button onClick={handleCreateOrder} disabled={savingOrder || !orderItems.some((i) => i.quantity_kg && i.price_per_kg_jpy)}
                          className="bg-slate-800 hover:bg-slate-900 text-white">
                          {savingOrder ? '保存中...' : '発注を作成'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {orders.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">まだ発注がありません</p>
            ) : (
              <div className="space-y-2">
                {orders.map((order) => (
                  <div key={order.po_id} className="border border-slate-200 rounded-lg">
                    <div
                      className="px-4 py-3 flex items-center gap-4 cursor-pointer hover:bg-slate-50"
                      onClick={() => setExpandedPo(expandedPo === order.po_id ? null : order.po_id)}
                    >
                      <span className="text-sm font-medium text-slate-900 w-28">{order.po_number}</span>
                      <span className="text-xs text-slate-500 w-24">{formatDate(order.order_date)}</span>
                      <span className="text-sm font-medium text-slate-900 flex-1">{formatCurrency(order.total_amount_jpy ?? 0)}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${DELIVERY_STATUS_COLORS[order.delivery_status] ?? ''}`}>
                        {order.delivery_status}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${PAYMENT_STATUS_COLORS[order.payment_status] ?? ''}`}>
                        {order.payment_status}
                      </span>
                    </div>
                    {expandedPo === order.po_id && (
                      <div className="px-4 pb-3 border-t border-slate-100">
                        <table className="w-full mt-2">
                          <thead>
                            <tr className="text-[10px] text-slate-400">
                              <th className="text-left pb-1">商品</th>
                              <th className="text-right pb-1">数量 (kg)</th>
                              <th className="text-right pb-1">単価 (¥/kg)</th>
                              <th className="text-right pb-1">小計</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map((item) => (
                              <tr key={item.item_id} className="text-xs text-slate-600">
                                <td className="py-1">{item.product_name_jpn ?? item.product_id ?? '—'}</td>
                                <td className="text-right py-1">{item.quantity_kg}</td>
                                <td className="text-right py-1">{formatCurrency(item.price_per_kg_jpy)}</td>
                                <td className="text-right py-1">{formatCurrency(item.subtotal_jpy ?? 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {order.notes && <p className="text-xs text-slate-500 mt-2">備考: {order.notes}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== COMMUNICATIONS TAB ===== */}
        {activeTab === 'comms' && (
          <div className="space-y-4">
            {canEdit && (
              <div className="border border-slate-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <select value={channel} onChange={(e) => setChannel(e.target.value)}
                    className="text-xs border border-slate-200 rounded px-2 py-1">
                    {CHANNEL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {templates.length > 0 && (
                    <select
                      onChange={(e) => {
                        const t = templates.find((t) => t.template_id === e.target.value)
                        if (t) { setMessageBody(t.message_body); setChannel(t.channel) }
                        e.target.value = ''
                      }}
                      className="text-xs border border-slate-200 rounded px-2 py-1 text-slate-400" defaultValue=""
                    >
                      <option value="" disabled>テンプレート</option>
                      {templates.map((t) => (
                        <option key={t.template_id} value={t.template_id}>{t.template_name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex gap-2">
                  <textarea value={messageBody} onChange={(e) => setMessageBody(e.target.value)}
                    className="flex-1 text-sm border border-slate-200 rounded px-3 py-1.5 resize-none" rows={3}
                    placeholder="コミュニケーション内容..." />
                  <button onClick={handleSendComm} disabled={sending || !messageBody.trim()}
                    className="self-end p-2 bg-slate-800 text-white rounded hover:bg-slate-900 disabled:opacity-50">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {comms.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">まだ記録がありません</p>
            ) : (
              <div className="space-y-3">
                {comms.map((c) => (
                  <div key={c.comm_id} className="border-l-2 border-slate-200 pl-3 py-1">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-medium text-slate-600">
                        {CHANNEL_OPTIONS.find((o) => o.value === c.channel)?.label ?? c.channel}
                      </span>
                      <span>{c.direction === 'inbound' ? '← 受信' : '→ 送信'}</span>
                      <span>{formatDate(c.created_at)}</span>
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

        {/* ===== PRODUCTS TAB ===== */}
        {activeTab === 'products' && (
          <div>
            {linkedProducts.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No products linked</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {linkedProducts.map((lp) => (
                  <div key={lp.id} className="border border-slate-200 rounded-lg p-4">
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
                    <div className="flex gap-4 mt-2 text-xs text-slate-500">
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
  )
}
