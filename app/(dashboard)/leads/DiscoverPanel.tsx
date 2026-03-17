'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Sparkles, MapPin, Instagram, ChevronDown, ChevronUp, ExternalLink, Clipboard, CheckCircle } from 'lucide-react'
import type { DiscoveryRun, DiscoveredProspect } from '@/types/database'
import DedupModal from './DedupModal'

const GEMINI_GEM_URL = 'https://gemini.google.com/gem/1-2Qp8zaZypF_ezuUTkLlvDprj3tcoyTh'

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

const SOURCE_LABELS: Record<string, string> = {
  google_maps: 'Google Maps',
  instagram: 'Instagram',
  gemini_tsv: 'Gemini',
}

export default function DiscoverPanel() {
  // Gemini card state
  const [geminiCity, setGeminiCity] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [copiedCity, setCopiedCity] = useState(false)

  // Maps card state
  const [mapsLocation, setMapsLocation] = useState('')
  const [mapsRadius, setMapsRadius] = useState('10')
  const [mapsKeywords, setMapsKeywords] = useState('cafe, coffee shop, matcha, tea house')
  const [mapsLoading, setMapsLoading] = useState(false)
  const [mapsRunId, setMapsRunId] = useState<string | null>(null)

  // Instagram card state
  const [igHashtags, setIgHashtags] = useState('matchalatte, matchacafe, specialtycoffee')
  const [igLocation, setIgLocation] = useState('')
  const [igLoading, setIgLoading] = useState(false)
  const [igRunId, setIgRunId] = useState<string | null>(null)

  // Shared state
  const [runs, setRuns] = useState<DiscoveryRun[]>([])
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)
  const [expandedProspects, setExpandedProspects] = useState<DiscoveredProspect[]>([])

  // Dedup modal
  const [dedupModal, setDedupModal] = useState<{
    open: boolean
    runId: string
    prospects: DiscoveredProspect[]
    source: string
  }>({ open: false, runId: '', prospects: [], source: '' })
  const [importing, setImporting] = useState(false)

  // Error
  const [error, setError] = useState('')

  // Load recent runs
  const fetchRuns = useCallback(async () => {
    const res = await fetch('/api/discover/runs')
    if (res.ok) {
      const data = await res.json()
      setRuns(data)
    }
  }, [])

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

  // Poll running jobs
  useEffect(() => {
    const runningRuns = runs.filter(r => r.status === 'running')
    if (runningRuns.length === 0) return

    const interval = setInterval(async () => {
      for (const run of runningRuns) {
        const source = run.source === 'google_maps' ? 'maps-search' : 'instagram-search'
        const res = await fetch(`/api/discover/${source}/status?run_id=${run.run_id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.status !== 'running') {
            // Run completed — refresh runs list
            fetchRuns()
            if (run.source === 'google_maps') {
              setMapsLoading(false)
              setMapsRunId(null)
            } else {
              setIgLoading(false)
              setIgRunId(null)
            }
            // Auto-open dedup modal
            if (data.status === 'completed' && data.prospects?.length > 0) {
              setDedupModal({
                open: true,
                runId: run.run_id,
                prospects: data.prospects,
                source: SOURCE_LABELS[run.source] || run.source,
              })
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

    // Parse TSV
    const lines = pasteText.trim().split('\n')
    if (lines.length < 2) {
      setError('Need at least a header row and one data row')
      return
    }

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

    if (rows.length === 0) {
      setError('No valid rows found in pasted data')
      return
    }

    // Import via paste-import endpoint
    const res = await fetch('/api/leads/paste-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, source_type: 'gemini' }),
    })

    if (res.ok) {
      const data = await res.json()
      setPasteText('')
      setShowPaste(false)
      setError('')
      alert(`Imported ${data.imported} leads (${data.skipped} duplicates skipped)`)
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
      body: JSON.stringify({
        location: mapsLocation.trim(),
        radius_miles: parseInt(mapsRadius),
        keywords: mapsKeywords,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      setMapsRunId(data.run_id)
      fetchRuns()
    } else {
      const data = await res.json()
      setError(data.error || 'Search failed')
      setMapsLoading(false)
    }
  }

  // --- Instagram ---
  async function handleIgSearch() {
    if (!igHashtags.trim()) return
    setIgLoading(true)
    setError('')

    const res = await fetch('/api/discover/instagram-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hashtags: igHashtags.trim(),
        location: igLocation.trim() || undefined,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      setIgRunId(data.run_id)
      fetchRuns()
    } else {
      const data = await res.json()
      setError(data.error || 'Search failed')
      setIgLoading(false)
    }
  }

  // --- Import ---
  async function handleImport(skipDuplicates: boolean) {
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
      const data = await res.json()
      setError(data.error || 'Import failed')
    }
    setImporting(false)
  }

  // --- Expand run ---
  async function toggleRunExpand(runId: string) {
    if (expandedRunId === runId) {
      setExpandedRunId(null)
      return
    }

    const source = runs.find(r => r.run_id === runId)?.source
    const endpoint = source === 'google_maps' ? 'maps-search' : 'instagram-search'
    const res = await fetch(`/api/discover/${endpoint}/status?run_id=${runId}`)
    if (res.ok) {
      const data = await res.json()
      setExpandedProspects(data.prospects ?? [])
    }
    setExpandedRunId(runId)
  }

  const inputClass = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500'

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Tool Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1: Gemini */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Generate Leads</h3>
          <p className="text-xs text-slate-500">Open Gemini to find cafés in a target city</p>

          <input
            type="text"
            value={geminiCity}
            onChange={e => setGeminiCity(e.target.value)}
            placeholder="e.g. Austin, TX"
            className={inputClass}
          />

          <div className="flex gap-2">
            <button
              onClick={handleOpenGemini}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-900"
            >
              {copiedCity ? 'Copied! Paste city in Gemini' : 'Open Gemini'}
              {copiedCity && <CheckCircle className="w-3.5 h-3.5 text-green-300" />}
            </button>
            <button
              onClick={() => setShowPaste(!showPaste)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Clipboard className="w-3.5 h-3.5" />
              Paste Results
            </button>
          </div>

          {showPaste && (
            <div className="space-y-2">
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                rows={5}
                placeholder="Paste TSV output from Gemini here..."
                className={`${inputClass} resize-none font-mono text-xs`}
              />
              <button
                onClick={handlePasteImport}
                disabled={!pasteText.trim()}
                className="w-full px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50"
              >
                Import
              </button>
            </div>
          )}
        </div>

        {/* Card 2: Google Maps */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Google Maps Search</h3>
          <p className="text-xs text-slate-500">Find cafés in an area via Google Maps</p>

          <input
            type="text"
            value={mapsLocation}
            onChange={e => setMapsLocation(e.target.value)}
            placeholder="e.g. Brooklyn, NY"
            className={inputClass}
          />

          <div className="grid grid-cols-2 gap-2">
            <select
              value={mapsRadius}
              onChange={e => setMapsRadius(e.target.value)}
              className={inputClass}
            >
              <option value="5">5 mi radius</option>
              <option value="10">10 mi radius</option>
              <option value="25">25 mi radius</option>
            </select>
            <input
              type="text"
              value={mapsKeywords}
              onChange={e => setMapsKeywords(e.target.value)}
              placeholder="Keywords..."
              className={`${inputClass} text-xs`}
            />
          </div>

          <button
            onClick={handleMapsSearch}
            disabled={mapsLoading || !mapsLocation.trim()}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {mapsLoading ? 'Searching...' : 'Search Google Maps'}
          </button>

          {mapsLoading && (
            <p className="text-xs text-slate-400 text-center">Running in background — you can navigate away</p>
          )}
        </div>

        {/* Card 3: Instagram */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Instagram Search</h3>
          <p className="text-xs text-slate-500">Find cafés posting about matcha on Instagram</p>

          <input
            type="text"
            value={igHashtags}
            onChange={e => setIgHashtags(e.target.value)}
            placeholder="matchalatte, matchacafe, specialtycoffee"
            className={inputClass}
          />

          <input
            type="text"
            value={igLocation}
            onChange={e => setIgLocation(e.target.value)}
            placeholder="Location (optional, e.g. New York)"
            className={inputClass}
          />

          <button
            onClick={handleIgSearch}
            disabled={igLoading || !igHashtags.trim()}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {igLoading ? 'Searching...' : 'Search Instagram'}
          </button>

          {igLoading && (
            <p className="text-xs text-slate-400 text-center">Running in background — you can navigate away</p>
          )}
        </div>
      </div>

      {/* Recent Discoveries */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Recent Discoveries</h3>
        {runs.length === 0 ? (
          <p className="text-sm text-slate-400">No discovery runs yet. Use the tools above to find prospects.</p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 w-8" />
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Source</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Search</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Results</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Imported</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Status</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map(run => {
                  const isExpanded = expandedRunId === run.run_id
                  const params = run.params as Record<string, string> | null
                  const searchDesc = params?.location || params?.hashtags || '—'

                  return (
                    <RunRow
                      key={run.run_id}
                      run={run}
                      searchDesc={searchDesc}
                      isExpanded={isExpanded}
                      prospects={isExpanded ? expandedProspects : []}
                      onToggle={() => toggleRunExpand(run.run_id)}
                      onImport={() => {
                        if (expandedProspects.length > 0) {
                          setDedupModal({
                            open: true,
                            runId: run.run_id,
                            prospects: expandedProspects,
                            source: SOURCE_LABELS[run.source] || run.source,
                          })
                        }
                      }}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dedup Modal */}
      <DedupModal
        open={dedupModal.open}
        onClose={() => setDedupModal({ open: false, runId: '', prospects: [], source: '' })}
        runId={dedupModal.runId}
        prospects={dedupModal.prospects}
        source={dedupModal.source}
        onImport={handleImport}
        importing={importing}
      />
    </div>
  )
}

// --- Run Row ---

function RunRow({
  run,
  searchDesc,
  isExpanded,
  prospects,
  onToggle,
  onImport,
}: {
  run: DiscoveryRun
  searchDesc: string
  isExpanded: boolean
  prospects: DiscoveredProspect[]
  onToggle: () => void
  onImport: () => void
}) {
  const statusBadge = () => {
    if (run.status === 'running') return <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-50 text-blue-600">Running...</span>
    if (run.status === 'completed') return <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-50 text-green-600">Complete</span>
    return <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-50 text-red-600">Failed</span>
  }

  return (
    <>
      <tr className="hover:bg-slate-50 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-2.5 text-slate-400">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </td>
        <td className="px-4 py-2.5">
          <span className="text-xs font-medium">{SOURCE_LABELS[run.source] || run.source}</span>
        </td>
        <td className="px-4 py-2.5 text-slate-600 text-xs truncate max-w-[200px]">{searchDesc}</td>
        <td className="px-4 py-2.5 text-center tabular-nums">{run.results_count || '—'}</td>
        <td className="px-4 py-2.5 text-center tabular-nums">
          {run.imported_count > 0 ? (
            <span>{run.imported_count} imported{run.duplicates_skipped > 0 ? `, ${run.duplicates_skipped} skipped` : ''}</span>
          ) : '—'}
        </td>
        <td className="px-4 py-2.5 text-center">{statusBadge()}</td>
        <td className="px-4 py-2.5 text-right text-xs text-slate-400">{relativeTime(run.created_at)}</td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={7} className="p-0">
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200">
              {prospects.length === 0 ? (
                <p className="text-xs text-slate-400">No prospects in this run.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">{prospects.length} prospects</span>
                    {run.imported_count === 0 && run.status === 'completed' && (
                      <button
                        onClick={e => { e.stopPropagation(); onImport() }}
                        className="px-3 py-1 text-xs font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-900"
                      >
                        Import to Leads
                      </button>
                    )}
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-200">
                        <th className="text-left pb-1.5 pr-3">Café</th>
                        <th className="text-left pb-1.5 pr-3">City</th>
                        <th className="text-center pb-1.5 pr-3">Rating</th>
                        <th className="text-left pb-1.5 pr-3">Instagram</th>
                        <th className="text-center pb-1.5 pr-3">Matcha</th>
                        <th className="text-center pb-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prospects.slice(0, 20).map(p => (
                        <tr key={p.prospect_id} className="border-b border-slate-100">
                          <td className="py-1.5 pr-3 font-medium text-slate-700">{p.cafe_name}</td>
                          <td className="py-1.5 pr-3 text-slate-500">{p.city || '—'}</td>
                          <td className="py-1.5 pr-3 text-center text-slate-500">
                            {p.rating ? `${p.rating}★` : '—'}
                          </td>
                          <td className="py-1.5 pr-3 text-slate-500 truncate max-w-[120px]">
                            {p.instagram_handle ? `@${p.instagram_handle}` : '—'}
                          </td>
                          <td className="py-1.5 pr-3 text-center">
                            {p.serves_matcha === 'Yes' ? (
                              <span className="text-green-600">Yes</span>
                            ) : p.serves_matcha === 'No' ? (
                              <span className="text-red-500">No</span>
                            ) : (
                              <span className="text-slate-400">?</span>
                            )}
                          </td>
                          <td className="py-1.5 text-center">
                            {p.imported ? (
                              <span className="text-green-600">Imported</span>
                            ) : p.is_duplicate ? (
                              <span className="text-amber-600">Duplicate</span>
                            ) : (
                              <span className="text-slate-400">Pending</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {prospects.length > 20 && (
                    <p className="text-xs text-slate-400 mt-2">Showing first 20 of {prospects.length}</p>
                  )}
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
