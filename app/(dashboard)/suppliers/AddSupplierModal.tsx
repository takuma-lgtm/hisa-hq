'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { SupplierBusinessType } from '@/types/database'
import { SUPPLIER_BUSINESS_TYPE_LABELS } from '@/types/database'

export default function AddSupplierModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [prefecture, setPrefecture] = useState('')
  const [businessType, setBusinessType] = useState<SupplierBusinessType | ''>('')
  const [source, setSource] = useState('')
  const [memo, setMemo] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_name: name.trim(),
          supplier_name_en: nameEn.trim() || null,
          prefecture: prefecture.trim() || null,
          business_type: businessType || null,
          source: source.trim() || null,
          memo: memo.trim() || null,
        }),
      })
      if (res.ok) {
        setOpen(false)
        setName('')
        setNameEn('')
        setPrefecture('')
        setBusinessType('')
        setSource('')
        setMemo('')
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-green-700 hover:bg-green-800 text-white text-sm gap-1.5">
          <Plus className="w-4 h-4" />
          Add Supplier
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新しい仕入れ先を追加</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">企業名 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
              placeholder="例: 南山園"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">English Name *</label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
              placeholder="e.g. Nanzanen"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">都道府県</label>
            <input
              type="text"
              value={prefecture}
              onChange={(e) => setPrefecture(e.target.value)}
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
              placeholder="例: 愛知"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">業態区分</label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value as SupplierBusinessType | '')}
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
            >
              <option value="">選択してください</option>
              {(Object.entries(SUPPLIER_BUSINESS_TYPE_LABELS) as [SupplierBusinessType, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">入り口</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
              placeholder="例: 問い合わせフォーム"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">メモ</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm resize-none"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button
              type="submit"
              disabled={saving || !name.trim() || !nameEn.trim()}
              className="bg-green-700 hover:bg-green-800 text-white"
            >
              {saving ? '保存中...' : '追加'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
