'use client'

import { useState } from 'react'

interface Props {
  token: string
  briefText: string
  alreadyPosted: boolean
  postedAt: string | null
  existingNotes: string | null
}

type PostState = 'idle' | 'posting' | 'posted' | 'error'

export default function DailyBriefClient({
  token,
  alreadyPosted,
  postedAt,
  existingNotes,
}: Props) {
  const [supplierNotes, setSupplierNotes] = useState(existingNotes ?? '')
  const [state, setState] = useState<PostState>(alreadyPosted ? 'posted' : 'idle')
  const [postedTime, setPostedTime] = useState<string | null>(postedAt)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handlePost() {
    setState('posting')
    setErrorMsg(null)

    try {
      const res = await fetch('/api/daily-brief/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          supplier_notes: supplierNotes.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setState('error')
        setErrorMsg(data.error ?? 'Failed to post')
        return
      }

      setState('posted')
      setPostedTime(data.posted_at)
    } catch {
      setState('error')
      setErrorMsg('Network error')
    }
  }

  const postedDate = postedTime
    ? new Date(postedTime).toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Asia/Tokyo',
      })
    : null

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        Post to Google Chat
      </h3>

      {/* Supplier notes */}
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">
          Supplier Updates <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={supplierNotes}
          onChange={(e) => setSupplierNotes(e.target.value)}
          placeholder="Add any supplier updates, shipping notes, or context…"
          rows={4}
          disabled={state === 'posting'}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 resize-none disabled:opacity-50"
        />
      </div>

      {/* Post button + status */}
      <div className="flex items-center gap-3">
        <button
          onClick={handlePost}
          disabled={state === 'posting'}
          className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state === 'posting' ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Posting…
            </>
          ) : state === 'posted' ? (
            'Post Again'
          ) : (
            'Post to Google Chat'
          )}
        </button>

        {state === 'posted' && (
          <span className="flex items-center gap-1 text-xs text-green-700">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Posted{postedDate ? ` at ${postedDate} JST` : ''}
          </span>
        )}

        {state === 'error' && (
          <span className="text-xs text-red-600">{errorMsg}</span>
        )}
      </div>

      {alreadyPosted && state !== 'error' && (
        <p className="text-xs text-slate-400">
          This brief was previously posted. You can post again with updated supplier notes.
        </p>
      )}
    </div>
  )
}
