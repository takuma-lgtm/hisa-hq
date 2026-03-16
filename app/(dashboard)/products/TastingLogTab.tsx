'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import type { SensoryLog } from '@/types/database'

interface Props {
  productId: string
  isAdmin: boolean
}

export default function TastingLogTab({ productId, isAdmin }: Props) {
  const [logs, setLogs] = useState<SensoryLog[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/products/${encodeURIComponent(productId)}/sensory-logs`)
    if (res.ok) setLogs(await res.json())
    setLoading(false)
  }, [productId])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  async function handleDelete(logId: string) {
    const res = await fetch(
      `/api/products/${encodeURIComponent(productId)}/sensory-logs/${logId}`,
      { method: 'DELETE' },
    )
    if (res.ok) setLogs((prev) => prev.filter((l) => l.log_id !== logId))
  }

  return (
    <div className="space-y-4">
      {/* Add entry button / form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
        >
          + Add Tasting Entry
        </button>
      ) : (
        <TastingForm
          productId={productId}
          onSaved={(entry) => {
            setLogs((prev) => [entry, ...prev])
            setShowForm(false)
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Log entries */}
      {loading ? (
        <p className="text-xs text-slate-400 text-center py-6">Loading...</p>
      ) : logs.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">No tasting entries yet.</p>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <LogCard key={log.log_id} log={log} isAdmin={isAdmin} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rating Circles
// ---------------------------------------------------------------------------

function RatingCircles({
  value,
  max = 5,
  onChange,
}: {
  value: number | null
  max?: number
  onChange?: (v: number | null) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => {
            if (!onChange) return
            onChange(value === i + 1 ? null : i + 1)
          }}
          disabled={!onChange}
          className={`w-3.5 h-3.5 rounded-full transition-colors ${
            value != null && i < value ? 'bg-green-500' : 'bg-slate-200'
          } ${onChange ? 'cursor-pointer hover:bg-green-300' : ''}`}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Log Card
// ---------------------------------------------------------------------------

function LogCard({
  log,
  isAdmin,
  onDelete,
}: {
  log: SensoryLog
  isAdmin: boolean
  onDelete: (id: string) => void
}) {
  const date = new Date(log.tasted_at + 'T00:00:00')
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const hasRatings = log.umami_rating != null || log.bitterness_rating != null || log.fineness_rating != null
  const extraNotes = [
    log.color_notes && `Color: ${log.color_notes}`,
    log.texture_notes && `Texture: ${log.texture_notes}`,
    log.aroma_notes && `Aroma: ${log.aroma_notes}`,
    log.comparison_notes && `Comparison: ${log.comparison_notes}`,
    log.general_notes && `Notes: ${log.general_notes}`,
  ].filter(Boolean) as string[]

  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-slate-900">{log.taster_name}</span>
          <span className="text-xs text-slate-400 ml-2">{dateStr}</span>
        </div>
        {isAdmin && (
          <button
            onClick={() => onDelete(log.log_id)}
            className="text-slate-300 hover:text-red-500 transition-colors"
            title="Delete entry"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {hasRatings && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {log.umami_rating != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 w-14">Umami</span>
              <RatingCircles value={log.umami_rating} />
            </div>
          )}
          {log.bitterness_rating != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 w-14">Bitter</span>
              <RatingCircles value={log.bitterness_rating} />
            </div>
          )}
          {log.fineness_rating != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 w-14">Fineness</span>
              <RatingCircles value={log.fineness_rating} />
            </div>
          )}
        </div>
      )}

      {log.flavor_notes && (
        <p className="text-sm text-slate-700">{log.flavor_notes}</p>
      )}

      {extraNotes.length > 0 && (
        <div className="space-y-0.5">
          {extraNotes.map((n, i) => (
            <p key={i} className="text-xs text-slate-500">{n}</p>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tasting Form
// ---------------------------------------------------------------------------

function TastingForm({
  productId,
  onSaved,
  onCancel,
}: {
  productId: string
  onSaved: (entry: SensoryLog) => void
  onCancel: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [tasterName, setTasterName] = useState('')
  const [tastedAt, setTastedAt] = useState(new Date().toISOString().slice(0, 10))
  const [umami, setUmami] = useState<number | null>(null)
  const [bitterness, setBitterness] = useState<number | null>(null)
  const [fineness, setFineness] = useState<number | null>(null)
  const [flavorNotes, setFlavorNotes] = useState('')
  const [colorNotes, setColorNotes] = useState('')
  const [textureNotes, setTextureNotes] = useState('')
  const [aromaNotes, setAromaNotes] = useState('')
  const [comparisonNotes, setComparisonNotes] = useState('')
  const [generalNotes, setGeneralNotes] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tasterName.trim() || !flavorNotes.trim()) return
    setSaving(true)

    const res = await fetch(`/api/products/${encodeURIComponent(productId)}/sensory-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taster_name: tasterName.trim(),
        tasted_at: tastedAt,
        umami_rating: umami,
        bitterness_rating: bitterness,
        fineness_rating: fineness,
        flavor_notes: flavorNotes.trim(),
        color_notes: colorNotes.trim() || null,
        texture_notes: textureNotes.trim() || null,
        aroma_notes: aromaNotes.trim() || null,
        comparison_notes: comparisonNotes.trim() || null,
        general_notes: generalNotes.trim() || null,
      }),
    })

    if (res.ok) {
      const entry = await res.json()
      onSaved(entry)
    }
    setSaving(false)
  }

  const inputClass = 'w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent'

  return (
    <form onSubmit={handleSubmit} className="border border-green-200 rounded-lg p-3 space-y-3 bg-green-50/30">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide">Taster Name *</label>
          <input
            value={tasterName}
            onChange={(e) => setTasterName(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide">Date</label>
          <input
            type="date"
            value={tastedAt}
            onChange={(e) => setTastedAt(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Ratings */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-600 w-16">Umami</span>
          <RatingCircles value={umami} onChange={setUmami} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-600 w-16">Bitterness</span>
          <RatingCircles value={bitterness} onChange={setBitterness} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-600 w-16">Fineness</span>
          <RatingCircles value={fineness} onChange={setFineness} />
        </div>
      </div>

      {/* Flavor notes (required) */}
      <div>
        <label className="text-[10px] text-slate-500 uppercase tracking-wide">Flavor Notes *</label>
        <textarea
          value={flavorNotes}
          onChange={(e) => setFlavorNotes(e.target.value)}
          className={`${inputClass} resize-none`}
          rows={2}
          required
        />
      </div>

      {/* Optional notes */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide">Color</label>
          <input value={colorNotes} onChange={(e) => setColorNotes(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide">Texture</label>
          <input value={textureNotes} onChange={(e) => setTextureNotes(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide">Aroma</label>
          <input value={aromaNotes} onChange={(e) => setAromaNotes(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide">Comparison</label>
          <input value={comparisonNotes} onChange={(e) => setComparisonNotes(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-slate-500 uppercase tracking-wide">General Notes</label>
        <input value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} className={inputClass} />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !tasterName.trim() || !flavorNotes.trim()}
          className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
