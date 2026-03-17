'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clipboard, CheckCircle, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import type { DiscoveryRun, DiscoveredProspect } from '@/types/database'
import DedupModal from './DedupModal'
import ManualLeadForm from './ManualLeadForm'

const GEMINI_GEM_URL = 'https://gemini.google.com/gem/1-2Qp8zaZypF_ezuUTkLlvDprj3tcoyTh'

const SOURCE_LABELS: Record<string, string> = {
  google_maps: 'Google Maps',
  instagram: 'Instagram',
  gemini_tsv: 'Gemini',
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function AddLeadsPanel({ onClose }: { onClose?: () => void }) {
  // Gemini
  const [geminiCity, setGeminiCity] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [copiedCity, setCopiedCity] = useState(false)

  // Maps
  const [mapsLocation, setMapsLocation] = useState('')
  const [mapsRadius, setMapsRadius] = useState('10')
  const [mapsKeywords, setMapsKeywords] = useState('cafe, coffee shop, matcha, tea house')
  const [mapsLoading, setMapsLoading] = useState(false)

  // Instagram
  const [igHashtags, setIgHashtags] = useState('matchalatte, matchacafe, specialtycoffee')
  const [igLocation, setIgLocation] = useState('')
  const [igLoading, setIgLoading] = useState(false)

  // Manual
  const [showManual, setShowManual] = useState(false)

  // Runs & dedup
  const [runs, setRuns] = useState<DiscoveryRun[]>([])
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)
  const [expandedProspects, setExpandedProspects] = useState<DiscoveredProspect[]>([])
  const [dedupModal, setDedupModal] = useState<{
    open: boolean; runId: string; prospects: DiscoveredProspect[]; source: string
  }>({ open: false, runId: '', prospects: [], source: '' })
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')

  const inputClass = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500'

  // Load recent runs
  const fetchRuns = useCallback(async () => {
    const res = await fetch('/api/discover/runs')
    if (res.ok) setRuns(await res.json())
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch
  useEffect(() => { fetchRuns() }, [fetchRuns])

  // Poll running jobs
  useEffect(() => {
    const running = runs.filter(r => r.status === 'running')
    if (running.length === 0) return

    const interval = setInterval(async () => {
      for (const run of running) {
        const source = run.source === 'google_maps' ? 'maps-search' : 'instagram-search'
        const res = await fetch(`/api/discover/${source}/status?run_id=${run.run_id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.status !== 'running') {
            fetchRuns()
            if (run.source === 'google_maps') setMapsLoading(false)
            else setIgLoading(false)
            if (data.status === 'completed' && data.prospects?.length > 0) {
              setDedupModal({ open: true, runId: run.run_id, prospects: data.prospects, source: SOURCE_LABELS[run.source] || run.source })
            }
          }
        }
      }
    }, 10_000)

    return () => clearInterval(interval)
  }, [runs, fetchRuns])

  // --- Gemini ---
  async function handleOpenGemini() {
    if (geminiCity.trim()) {
      await navigator.clipboard.writeText(geminiCity.trim())
      setCopiedCity(true)
      setTimeout(() => setCopiedCity(false), 2000)
    }
    window.open(GEMINI_GEM_URL, '_blank')
  }

  async function handlePasteImport() {
    if (!pasteText.trim()) return
    setError('')
    const lines = pasteText.trim().split('\n')
    if (lines.length < 2) { setError('Need at least a header row and one data row'); return }
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t')
      if (cols.length < 2) continue
      rows.push({
        date_generated: cols[0]?.trim() || null,
        cafe_name: cols[1]?.trim() || '',
        location: cols[2]?.trim() || '',
        serves_matcha: cols[3]?.trim() || null,
        instagram_url: cols[4]?.trim() || null,
        website_url: cols[5]?.trim() || null,
      })
    }
    if (rows.length === 0) { setError('No valid rows found'); return }
    const res = await fetch('/api/leads/paste-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, source_type: 'gemini' }),
    })
    if (res.ok) {
      const data = await res.json()
      setPasteText('')
      setShowPaste(false)
      alert(`Imported ${data.imported} leads (${data.skipped} duplicates skipped)`)
      window.location.reload()
    } else {
      const data = await res.json()
      setError(data.error || 'Import failed')
    }
  }

  // --- Maps ---
  async function handleMapsSearch() {
    if (!mapsLocation.trim()) return
    setMapsLoading(true)
    setError('')
    const res = await fetch('/api/discover/maps-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: mapsLocation.trim(), radius_miles: parseInt(mapsRadius, 10), keywords: mapsKeywords }),
    })
    if (res.ok) { fetchRuns() }
    else { setError((await res.json()).error || 'Search failed'); setMapsLoading(false) }
  }

  // --- Instagram ---
  async function handleIgSearch() {
    if (!igHashtags.trim()) return
    setIgLoading(true)
    setError('')
    const res = await fetch('/api/discover/instagram-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hashtags: igHashtags.trim(), location: igLocation.trim() || undefined }),
    })
    if (res.ok) { fetchRuns() }
    else { setError((await res.json()).error || 'Search failed'); setIgLoading(false) }
  }

  // --- Import from run ---
  async function handleImportRun(skipDuplicates: boolean) {
    setImporting(true)
    const res = await fetch('/api/discover/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_id: dedupModal.runId, skip_duplicates: skipDuplicates }),
    })
    if (res.ok) {
      const data = await res.json()
      setDedupModal({ open: false, runId: '', prospects: [], source: '' })
      fetchRuns()
      alert(`Imported ${data.imported} leads (${data.skipped} skipped)`)
    } else {
      setError((await res.json()).error || 'Import failed')
    }
    setImporting(false)
  }

  // --- Expand run ---
  async function toggleRunExpand(runId: string) {
    if (expandedRunId === runId) { setExpandedRunId(null); return }
    const source = runs.find(r => r.run_id === runId)?.source
    const endpoint = source === 'google_maps' ? 'maps-search' : 'instagram-search'
    const res = await fetch(`/api/discover/${endpoint}/status?run_id=${runId}`)
    if (res.ok) { setExpandedProspects((await res.json()).prospects ?? []) }
    setExpandedRunId(runId)
  }

  return (
    <div className="space-y-5 p-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>
      )}

      {/* Tool Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1: Gemini */}
        <div className="border border-slate-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Generate Leads</h3>
          <p className="text-xs text-slate-500">Open Gemini to find cafés in a target city</p>
          <input type="text" value={geminiCity} onChange={e => setGeminiCity(e.target.value)} placeholder="e.g. Austin, TX" className={inputClass} />
          <div className="flex gap-2">
            <button onClick={handleOpenGemini} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-900">
              {copiedCity ? 'Copied! Paste city in Gemini' : 'Open Gemini'}
              {copiedCity && <CheckCircle className="w-3.5 h-3.5 text-green-300" />}
            </button>
            <button onClick={() => setShowPaste(!showPaste)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
              <Clipboard className="w-3.5 h-3.5" />
              Paste
            </button>
          </div>
          {showPaste && (
            <div className="space-y-2">
              <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={4} placeholder="Paste TSV output from Gemini here..." className={`${inputClass} resize-none font-mono text-xs`} />
              <button onClick={handlePasteImport} disabled={!pasteText.trim()} className="w-full px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50">Import</button>
            </div>
          )}
        </div>

        {/* Card 2: Google Maps */}
        <div className="border border-slate-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Google Maps Search</h3>
          <p className="text-xs text-slate-500">Find cafés in an area via Google Maps</p>
          <input type="text" value={mapsLocation} onChange={e => setMapsLocation(e.target.value)} placeholder="e.g. Brooklyn, NY" className={inputClass} />
          <div className="grid grid-cols-2 gap-2">
            <select value={mapsRadius} onChange={e => setMapsRadius(e.target.value)} className={inputClass}>
              <option value="5">5 mi radius</option>
              <option value="10">10 mi radius</option>
              <option value="25">25 mi radius</option>
            </select>
            <input type="text" value={mapsKeywords} onChange={e => setMapsKeywords(e.target.value)} placeholder="Keywords..." className={`${inputClass} text-xs`} />
          </div>
          <button onClick={handleMapsSearch} disabled={mapsLoading || !mapsLocation.trim()} className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50">
            {mapsLoading ? 'Searching...' : 'Search Google Maps'}
          </button>
          {mapsLoading && <p className="text-xs text-slate-400 text-center">Running in background</p>}
        </div>

        {/* Card 3: Instagram */}
        <div className="border border-slate-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Instagram Search</h3>
          <p className="text-xs text-slate-500">Find cafés posting about matcha on Instagram</p>
          <input type="text" value={igHashtags} onChange={e => setIgHashtags(e.target.value)} placeholder="matchalatte, matchacafe, specialtycoffee" className={inputClass} />
          <input type="text" value={igLocation} onChange={e => setIgLocation(e.target.value)} placeholder="Location (optional, e.g. New York)" className={inputClass} />
          <button onClick={handleIgSearch} disabled={igLoading || !igHashtags.trim()} className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50">
            {igLoading ? 'Searching...' : 'Search Instagram'}
          </button>
          {igLoading && <p className="text-xs text-slate-400 text-center">Running in background</p>}
        </div>
      </div>

      {/* Manual Entry */}
      <div className="border border-slate-200 rounded-xl">
        <button onClick={() => setShowManual(!showManual)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 rounded-xl">
          <span className="flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add Lead Manually
          </span>
          {showManual ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {showManual && (
          <div className="border-t border-slate-200">
            <ManualLeadForm onClose={() => setShowManual(false)} />
          </div>
        )}
      </div>

      {/* Recent Discoveries */}
      {runs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Recent Discoveries</h3>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 w-8" />
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Source</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Search</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-500">Results</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-500">Status</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map(run => {
                  const isExpanded = expandedRunId === run.run_id
                  const params = run.params as Record<string, string> | null
                  const searchDesc = params?.location || params?.hashtags || '—'
                  const statusBadge = run.status === 'running'
                    ? <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-50 text-blue-600">Running</span>
                    : run.status === 'completed'
                      ? <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-50 text-green-600">Done</span>
                      : <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-50 text-red-600">Failed</span>

                  return (
                    <tr key={run.run_id} className="hover:bg-slate-50 cursor-pointer" onClick={() => toggleRunExpand(run.run_id)}>
                      <td className="px-3 py-2 text-slate-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </td>
                      <td className="px-3 py-2 text-xs font-medium">{SOURCE_LABELS[run.source] || run.source}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[150px]">{searchDesc}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-xs">{run.results_count || '—'}</td>
                      <td className="px-3 py-2 text-center">{statusBadge}</td>
                      <td className="px-3 py-2 text-right text-xs text-slate-400">{relativeTime(run.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-end pt-2">
        <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5">
          Close
        </button>
      </div>

      {/* Dedup Modal */}
      <DedupModal
        open={dedupModal.open}
        onClose={() => setDedupModal({ open: false, runId: '', prospects: [], source: '' })}
        runId={dedupModal.runId}
        prospects={dedupModal.prospects}
        source={dedupModal.source}
        onImport={handleImportRun}
        importing={importing}
      />
    </div>
  )
}
