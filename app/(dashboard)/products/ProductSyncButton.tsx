'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'

type SyncState = 'idle' | 'syncing' | 'success' | 'error'

interface SyncResult {
  upserted?: number
  total_rows?: number
  synced_at?: string
  message?: string
  error?: string
}

export default function ProductSyncButton() {
  const [state, setState] = useState<SyncState>('idle')
  const [result, setResult] = useState<SyncResult | null>(null)

  async function handleSync() {
    setState('syncing')
    setResult(null)

    try {
      const res = await fetch('/api/products/sync', { method: 'POST' })
      const data: SyncResult = await res.json()

      if (!res.ok) {
        setState('error')
        setResult(data)
      } else {
        setState('success')
        setResult(data)
        // Auto-reload page after 2s to show updated products
        setTimeout(() => window.location.reload(), 2000)
      }
    } catch {
      setState('error')
      setResult({ error: 'Network error — could not reach sync endpoint' })
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleSync}
        disabled={state === 'syncing'}
        className="inline-flex items-center gap-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${state === 'syncing' ? 'animate-spin' : ''}`} />
        {state === 'syncing' ? 'Syncing…' : 'Sync from Sheets'}
      </button>

      {state === 'success' && result && (
        <div className="flex items-center gap-1 text-xs text-green-700">
          <CheckCircle className="w-3 h-3" />
          {result.upserted != null
            ? `${result.upserted} product${result.upserted !== 1 ? 's' : ''} synced`
            : result.message}
        </div>
      )}

      {state === 'error' && result && (
        <div className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="w-3 h-3" />
          {result.error ?? 'Sync failed'}
        </div>
      )}
    </div>
  )
}
