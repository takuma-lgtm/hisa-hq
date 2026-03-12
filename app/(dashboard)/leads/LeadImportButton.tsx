'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'

type ImportState = 'idle' | 'importing' | 'success' | 'error'

interface ImportResult {
  imported?: number
  updated?: number
  skipped?: number
  by_region?: Record<string, number>
  error?: string
}

export default function LeadImportButton() {
  const [state, setState] = useState<ImportState>('idle')
  const [result, setResult] = useState<ImportResult | null>(null)

  async function handleImport() {
    setState('importing')
    setResult(null)

    try {
      const res = await fetch('/api/leads/sheets-import', { method: 'POST' })
      const data: ImportResult = await res.json()

      if (!res.ok) {
        setState('error')
        setResult(data)
      } else {
        setState('success')
        setResult(data)
        setTimeout(() => window.location.reload(), 2000)
      }
    } catch {
      setState('error')
      setResult({ error: 'Network error — could not reach import endpoint' })
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleImport}
        disabled={state === 'importing'}
        className="inline-flex items-center gap-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${state === 'importing' ? 'animate-spin' : ''}`} />
        {state === 'importing' ? 'Importing…' : 'Import from Sheets'}
      </button>

      {state === 'success' && result && (
        <div className="flex items-center gap-1 text-xs text-green-700">
          <CheckCircle className="w-3 h-3" />
          {result.imported != null
            ? `${result.imported} new, ${result.updated ?? 0} updated`
            : 'Import complete'}
        </div>
      )}

      {state === 'error' && result && (
        <div className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="w-3 h-3" />
          {result.error ?? 'Import failed'}
        </div>
      )}
    </div>
  )
}
