'use client'

import { useState, useCallback } from 'react'
import { AlertTriangle, CheckCircle, Loader2, MapPin } from 'lucide-react'
import { detectRegion, parseBool } from '@/lib/lead-utils'
import MapsSearchPanel from './MapsSearchPanel'
import ManualLeadForm from './ManualLeadForm'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedRow {
  date_generated: string | null
  cafe_name: string
  location: string
  serves_matcha: string | null
  instagram_url: string | null
  website_url: string | null
  // Client-side computed
  region: string
  selected: boolean
  isDuplicate: boolean
}

type ImportState = 'idle' | 'importing' | 'success' | 'error'

interface ImportResult {
  imported: number
  duplicates: number
  errors?: string[]
}

// ---------------------------------------------------------------------------
// TSV column order from Gemini output
// ---------------------------------------------------------------------------
// Date Generated | Cafe Name | Location | Serves Matcha? | Instagram URL | Website URL

function parseTsv(text: string): ParsedRow[] {
  const lines = text.split('\n').filter((l) => l.trim())
  const rows: ParsedRow[] = []

  for (const line of lines) {
    const cols = line.split('\t')
    // Skip header row if it looks like one
    if (cols[0]?.toLowerCase().includes('date') && cols[1]?.toLowerCase().includes('cafe')) continue

    const cafeName = cols[1]?.trim()
    if (!cafeName) continue

    const location = cols[2]?.trim() ?? ''

    rows.push({
      date_generated: cols[0]?.trim() || null,
      cafe_name: cafeName,
      location,
      serves_matcha: cols[3]?.trim() || null,
      instagram_url: cols[4]?.trim() || null,
      website_url: cols[5]?.trim() || null,
      region: detectRegion(location),
      selected: true,
      isDuplicate: false,
    })
  }

  return rows
}

// ---------------------------------------------------------------------------
// Dedup check
// ---------------------------------------------------------------------------

async function checkDuplicates(rows: ParsedRow[]): Promise<boolean[]> {
  try {
    const res = await fetch('/api/leads/check-duplicates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: rows.map((r) => ({
          cafe_name: r.cafe_name,
          location: r.location,
          instagram_url: r.instagram_url,
          website_url: r.website_url,
        })),
      }),
    })
    if (!res.ok) return rows.map(() => false)
    const data = await res.json()
    return data.duplicates ?? rows.map(() => false)
  } catch {
    return rows.map(() => false)
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Tab = 'paste' | 'maps' | 'manual'

export default function AddLeadsPanel({ onClose }: { onClose?: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('paste')
  const [rawText, setRawText] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [checking, setChecking] = useState(false)
  const [importState, setImportState] = useState<ImportState>('idle')
  const [result, setResult] = useState<ImportResult | null>(null)

  const runDedupCheck = useCallback(async (parsed: ParsedRow[]) => {
    if (parsed.length === 0) return
    setChecking(true)
    const dupes = await checkDuplicates(parsed)
    setRows((prev) =>
      prev.map((r, i) => ({
        ...r,
        isDuplicate: dupes[i] ?? false,
        selected: dupes[i] ? false : r.selected,
      }))
    )
    setChecking(false)
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text/plain')
    if (!text.includes('\t')) return // Not TSV, let default paste happen

    e.preventDefault()
    setRawText(text)
    const parsed = parseTsv(text)
    setRows(parsed)
    setImportState('idle')
    setResult(null)
    runDedupCheck(parsed)
  }, [runDedupCheck])

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setRawText(text)
    if (text.includes('\t')) {
      const parsed = parseTsv(text)
      setRows(parsed)
      runDedupCheck(parsed)
    } else {
      setRows([])
    }
    setImportState('idle')
    setResult(null)
  }, [runDedupCheck])

  const toggleRow = useCallback((index: number) => {
    setRows((prev) => prev.map((r, i) => i === index ? { ...r, selected: !r.selected } : r))
  }, [])

  const toggleAll = useCallback(() => {
    setRows((prev) => {
      const nonDupeRows = prev.filter((r) => !r.isDuplicate)
      const allSelected = nonDupeRows.every((r) => r.selected)
      return prev.map((r) => r.isDuplicate ? r : { ...r, selected: !allSelected })
    })
  }, [])

  const selectedCount = rows.filter((r) => r.selected).length
  const duplicateCount = rows.filter((r) => r.isDuplicate).length

  async function handleImport() {
    const selected = rows.filter((r) => r.selected)
    if (selected.length === 0) return

    setImportState('importing')
    setResult(null)

    try {
      const res = await fetch('/api/leads/paste-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: selected.map((r) => ({
            date_generated: r.date_generated,
            cafe_name: r.cafe_name,
            location: r.location,
            serves_matcha: r.serves_matcha,
            instagram_url: r.instagram_url,
            website_url: r.website_url,
          })),
          source_type: 'gemini',
        }),
      })

      const data: ImportResult & { error?: string } = await res.json()

      if (!res.ok) {
        setImportState('error')
        setResult({ imported: 0, duplicates: 0, errors: [data.error ?? 'Import failed'] })
      } else {
        setImportState('success')
        setResult(data)
        setTimeout(() => window.location.reload(), 2000)
      }
    } catch {
      setImportState('error')
      setResult({ imported: 0, duplicates: 0, errors: ['Network error'] })
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-slate-200 px-1">
        <button
          onClick={() => setActiveTab('paste')}
          className={`px-3 py-2 text-sm font-medium ${
            activeTab === 'paste'
              ? 'text-green-700 border-b-2 border-green-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Paste
        </button>
        <button
          onClick={() => setActiveTab('maps')}
          className={`px-3 py-2 text-sm font-medium inline-flex items-center gap-1 ${
            activeTab === 'maps'
              ? 'text-green-700 border-b-2 border-green-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          Search Maps
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`px-3 py-2 text-sm font-medium ${
            activeTab === 'manual'
              ? 'text-green-700 border-b-2 border-green-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Manual
        </button>
      </div>

      {/* Maps tab */}
      {activeTab === 'maps' && <MapsSearchPanel />}

      {/* Manual tab */}
      {activeTab === 'manual' && <ManualLeadForm />}

      {/* Paste tab */}
      {activeTab === 'paste' && <>
      <div className="p-4 space-y-3 flex-1 overflow-auto">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Paste TSV from Gemini
          </label>
          <textarea
            value={rawText}
            onChange={handleTextChange}
            onPaste={handlePaste}
            placeholder={`Date Generated\tCafe Name\tLocation\tServes Matcha?\tInstagram URL\tWebsite URL\n2025-03-10\tMatcha Cafe\tPortland, USA\tYes\thttps://instagram.com/matchacafe\thttps://matchacafe.com`}
            rows={5}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 font-mono outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none placeholder:text-slate-300"
          />
        </div>

        {/* Preview table */}
        {rows.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-600">
                {rows.length} rows parsed, {selectedCount} selected
                {checking && (
                  <span className="ml-2 text-slate-400">
                    <Loader2 className="w-3 h-3 inline animate-spin mr-1" />
                    Checking duplicates…
                  </span>
                )}
              </p>
              <button
                onClick={toggleAll}
                className="text-xs text-green-700 hover:text-green-800 font-medium"
              >
                {rows.filter((r) => !r.isDuplicate).every((r) => r.selected) ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {duplicateCount > 0 && !checking && (
              <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''} found — already in CRM. Deselected by default.
              </div>
            )}

            <div className="border border-slate-200 rounded-lg overflow-auto max-h-[50vh]">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="pl-3 pr-1 py-2 text-left w-8">
                      <input
                        type="checkbox"
                        checked={rows.filter((r) => !r.isDuplicate).every((r) => r.selected)}
                        onChange={toggleAll}
                        className="rounded border-slate-300 accent-green-600"
                      />
                    </th>
                    <th className="px-2 py-2 text-left text-slate-500 font-medium">Cafe Name</th>
                    <th className="px-2 py-2 text-left text-slate-500 font-medium">Location</th>
                    <th className="px-2 py-2 text-left text-slate-500 font-medium">Region</th>
                    <th className="px-2 py-2 text-left text-slate-500 font-medium">Matcha?</th>
                    <th className="px-2 py-2 text-left text-slate-500 font-medium">Instagram</th>
                    <th className="px-2 py-2 text-left text-slate-500 font-medium">Website</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b border-slate-100 ${
                        row.isDuplicate
                          ? 'bg-yellow-50'
                          : row.selected
                            ? ''
                            : 'opacity-40'
                      }`}
                    >
                      <td className="pl-3 pr-1 py-1.5">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => toggleRow(i)}
                          className="rounded border-slate-300 accent-green-600"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-slate-900 font-medium max-w-[140px] truncate">
                        {row.cafe_name}
                        {row.isDuplicate && (
                          <span className="ml-1 text-[10px] text-yellow-700 font-normal">duplicate</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-slate-600 max-w-[120px] truncate">
                        {row.location || '—'}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                          {row.region}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-slate-600">
                        {row.serves_matcha ? (parseBool(row.serves_matcha) ? 'Yes' : 'No') : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-slate-500 max-w-[100px] truncate">
                        {row.instagram_url || '—'}
                      </td>
                      <td className="px-2 py-1.5 text-slate-500 max-w-[100px] truncate">
                        {row.website_url || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Result feedback */}
        {importState === 'success' && result && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-800 text-sm">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>
              {result.imported} lead{result.imported !== 1 ? 's' : ''} imported
              {result.duplicates > 0 && `, ${result.duplicates} duplicate${result.duplicates !== 1 ? 's' : ''} skipped`}
            </span>
          </div>
        )}

        {importState === 'error' && result?.errors && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{result.errors[0]}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 shrink-0">
        <button
          onClick={onClose}
          className="text-sm text-slate-600 hover:text-slate-800 px-3 py-1.5"
        >
          Cancel
        </button>
        <button
          onClick={handleImport}
          disabled={selectedCount === 0 || importState === 'importing' || importState === 'success'}
          className="inline-flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {importState === 'importing' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {importState === 'importing'
            ? 'Importing…'
            : `Import ${selectedCount} Lead${selectedCount !== 1 ? 's' : ''}`}
        </button>
      </div>
      </>}
    </div>
  )
}
