'use client'

import { useState, useCallback } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  Search,
  Star,
} from 'lucide-react'
import { usePopover } from '@/components/ui/popover'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MapsResult {
  place_id: string
  cafe_name: string
  address: string
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  phone: string | null
  website_url: string | null
  email: string | null
  instagram_url: string | null
  google_rating: number | null
  google_review_count: number | null
  category: string | null
  // Client-side
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
// Dedup check
// ---------------------------------------------------------------------------

async function checkDuplicates(rows: MapsResult[]): Promise<boolean[]> {
  try {
    const res = await fetch('/api/leads/check-duplicates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: rows.map((r) => ({
          cafe_name: r.cafe_name,
          location: [r.city, r.country].filter(Boolean).join(', '),
          instagram_url: r.instagram_url,
          website_url: r.website_url,
          google_place_id: r.place_id,
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

export default function MapsSearchPanel() {
  const { closePopover } = usePopover()

  // Search form
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [maxResults, setMaxResults] = useState(20)
  const [scrapeContacts, setScrapeContacts] = useState(true)

  // Search state
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Results
  const [results, setResults] = useState<MapsResult[]>([])
  const [checking, setChecking] = useState(false)

  // Import
  const [importState, setImportState] = useState<ImportState>('idle')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const selectedCount = results.filter((r) => r.selected).length
  const duplicateCount = results.filter((r) => r.isDuplicate).length

  // ---- Search ----

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !location.trim()) return

    setSearching(true)
    setSearchError(null)
    setResults([])
    setImportState('idle')
    setImportResult(null)

    try {
      const res = await fetch('/api/leads/apify-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          location: location.trim(),
          maxResults,
          scrapeContacts,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSearchError(data.error ?? 'Search failed')
        setSearching(false)
        return
      }

      const mapped: MapsResult[] = (data.results ?? []).map(
        (r: MapsResult) => ({
          ...r,
          selected: true,
          isDuplicate: false,
        }),
      )

      setResults(mapped)
      setSearching(false)

      // Run dedup check
      if (mapped.length > 0) {
        setChecking(true)
        const dupes = await checkDuplicates(mapped)
        setResults((prev) =>
          prev.map((r, i) => ({
            ...r,
            isDuplicate: dupes[i] ?? false,
            selected: dupes[i] ? false : r.selected,
          })),
        )
        setChecking(false)
      }
    } catch {
      setSearchError('Network error')
      setSearching(false)
    }
  }, [query, location, maxResults, scrapeContacts])

  // ---- Toggle ----

  const toggleRow = useCallback((index: number) => {
    setResults((prev) =>
      prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r)),
    )
  }, [])

  const toggleAll = useCallback(() => {
    setResults((prev) => {
      const nonDupe = prev.filter((r) => !r.isDuplicate)
      const allSelected = nonDupe.every((r) => r.selected)
      return prev.map((r) =>
        r.isDuplicate ? r : { ...r, selected: !allSelected },
      )
    })
  }, [])

  // ---- Import ----

  async function handleImport() {
    const selected = results.filter((r) => r.selected)
    if (selected.length === 0) return

    setImportState('importing')
    setImportResult(null)

    try {
      const res = await fetch('/api/leads/apify-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: selected.map((r) => ({
            place_id: r.place_id,
            cafe_name: r.cafe_name,
            address: r.address,
            city: r.city,
            state: r.state,
            zip_code: r.zip_code,
            country: r.country,
            phone: r.phone,
            website_url: r.website_url,
            email: r.email,
            instagram_url: r.instagram_url,
            google_rating: r.google_rating,
            google_review_count: r.google_review_count,
            category: r.category,
          })),
        }),
      })

      const data: ImportResult & { error?: string } = await res.json()

      if (!res.ok) {
        setImportState('error')
        setImportResult({
          imported: 0,
          duplicates: 0,
          errors: [data.error ?? 'Import failed'],
        })
      } else {
        setImportState('success')
        setImportResult(data)
        setTimeout(() => window.location.reload(), 2000)
      }
    } catch {
      setImportState('error')
      setImportResult({
        imported: 0,
        duplicates: 0,
        errors: ['Network error'],
      })
    }
  }

  // ---- Render ----

  return (
    <div className="flex flex-col h-full">
      {/* Search form */}
      <div className="p-4 space-y-3 flex-1 overflow-auto">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="matcha cafe, coffee shop..."
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Portland, Oregon"
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={searching || !query.trim() || !location.trim()}
            className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {searching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            Search
          </button>
        </div>

        {/* Options row */}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={scrapeContacts}
              onChange={(e) => setScrapeContacts(e.target.checked)}
              className="rounded border-slate-300 accent-green-600"
            />
            Include emails & socials
          </label>
          <label className="flex items-center gap-1.5">
            Max results:
            <select
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              className="border border-slate-200 rounded px-1.5 py-0.5 text-xs outline-none"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>

        {/* Loading state */}
        {searching && (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Searching Google Maps for &ldquo;{query}&rdquo; near {location}...
          </div>
        )}

        {/* Search error */}
        {searchError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{searchError}</span>
          </div>
        )}

        {/* Results table */}
        {results.length > 0 && !searching && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-600">
                {results.length} results found, {selectedCount} selected
                {checking && (
                  <span className="ml-2 text-slate-400">
                    <Loader2 className="w-3 h-3 inline animate-spin mr-1" />
                    Checking duplicates...
                  </span>
                )}
              </p>
              <button
                onClick={toggleAll}
                className="text-xs text-green-700 hover:text-green-800 font-medium"
              >
                {results
                  .filter((r) => !r.isDuplicate)
                  .every((r) => r.selected)
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            </div>

            {duplicateCount > 0 && !checking && (
              <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''}{' '}
                found — already in CRM. Deselected by default.
              </div>
            )}

            <div className="border border-slate-200 rounded-lg overflow-auto max-h-[50vh]">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="pl-3 pr-1 py-2 text-left w-8">
                      <input
                        type="checkbox"
                        checked={results
                          .filter((r) => !r.isDuplicate)
                          .every((r) => r.selected)}
                        onChange={toggleAll}
                        className="rounded border-slate-300 accent-green-600"
                      />
                    </th>
                    <th className="px-2 py-2 text-left text-slate-500 font-medium">
                      Cafe Name
                    </th>
                    <th className="px-2 py-2 text-left text-slate-500 font-medium">
                      Address
                    </th>
                    <th className="px-2 py-2 text-left text-slate-500 font-medium">
                      Rating
                    </th>
                    <th className="px-2 py-2 text-left text-slate-500 font-medium">
                      Reviews
                    </th>
                    <th className="px-2 py-2 text-left text-slate-500 font-medium">
                      Phone
                    </th>
                    <th className="px-2 py-2 text-left text-slate-500 font-medium">
                      Website
                    </th>
                    {scrapeContacts && (
                      <th className="px-2 py-2 text-left text-slate-500 font-medium">
                        Email
                      </th>
                    )}
                    <th className="px-2 py-2 text-left text-slate-500 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, i) => (
                    <tr
                      key={row.place_id || i}
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
                      </td>
                      <td
                        className="px-2 py-1.5 text-slate-600 max-w-[140px] truncate"
                        title={row.address}
                      >
                        {row.address || '—'}
                      </td>
                      <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">
                        {row.google_rating != null ? (
                          <span className="inline-flex items-center gap-0.5">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            {row.google_rating.toFixed(1)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-slate-600">
                        {row.google_review_count ?? '—'}
                      </td>
                      <td className="px-2 py-1.5 text-slate-500 max-w-[90px] truncate">
                        {row.phone || '—'}
                      </td>
                      <td className="px-2 py-1.5 text-slate-500 max-w-[100px] truncate">
                        {row.website_url || '—'}
                      </td>
                      {scrapeContacts && (
                        <td className="px-2 py-1.5 text-slate-500 max-w-[100px] truncate">
                          {row.email || '—'}
                        </td>
                      )}
                      <td className="px-2 py-1.5">
                        {row.isDuplicate ? (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-700">
                            Duplicate
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700">
                            New
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Import feedback */}
        {importState === 'success' && importResult && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-800 text-sm">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>
              {importResult.imported} lead
              {importResult.imported !== 1 ? 's' : ''} imported
              {importResult.duplicates > 0 &&
                `, ${importResult.duplicates} duplicate${importResult.duplicates !== 1 ? 's' : ''} skipped`}
            </span>
          </div>
        )}

        {importState === 'error' && importResult?.errors && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{importResult.errors[0]}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 shrink-0">
        <button
          onClick={closePopover}
          className="text-sm text-slate-600 hover:text-slate-800 px-3 py-1.5"
        >
          Cancel
        </button>
        <button
          onClick={handleImport}
          disabled={
            selectedCount === 0 ||
            importState === 'importing' ||
            importState === 'success'
          }
          className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {importState === 'importing' && (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          )}
          {importState === 'importing'
            ? 'Adding...'
            : `Add ${selectedCount} Selected`}
        </button>
      </div>
    </div>
  )
}
