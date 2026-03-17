'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Users, Target, Package, Boxes, FileText } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface SearchResult {
  id: string
  label: string
  subtitle: string
  type: 'lead' | 'opportunity' | 'product' | 'supplier' | 'sku' | 'invoice'
  href: string
}

const TYPE_META: Record<string, { label: string; icon: typeof Users }> = {
  lead: { label: 'Leads', icon: Users },
  opportunity: { label: 'Opportunities', icon: Target },
  product: { label: 'Products', icon: Package },
  supplier: { label: 'Suppliers', icon: Users },
  sku: { label: 'Inventory', icon: Boxes },
  invoice: { label: 'Invoices', icon: FileText },
}

const TYPE_ORDER = ['lead', 'opportunity', 'product', 'supplier', 'sku', 'invoice']

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Listen for sidebar trigger
  useEffect(() => {
    function handleOpen() { setOpen(true) }
    window.addEventListener('open-search', handleOpen)
    return () => window.removeEventListener('open-search', handleOpen)
  }, [])

  // Cmd+K shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  // Reset on close
  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen)
    if (!isOpen) {
      setQuery('')
      setResults([])
      setActiveIndex(0)
    }
  }

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data.results ?? [])
      setActiveIndex(0)
    } finally {
      setLoading(false)
    }
  }, [])

  function handleQueryChange(value: string) {
    setQuery(value)
    clearTimeout(debounceRef.current)
    if (value.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(() => search(value), 250)
  }

  // Group results by type
  const grouped = TYPE_ORDER
    .map((type) => ({
      type,
      meta: TYPE_META[type],
      items: results.filter((r) => r.type === type),
    }))
    .filter((g) => g.items.length > 0)

  // Flat list for keyboard nav
  const flatResults = grouped.flatMap((g) => g.items)

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && flatResults[activeIndex]) {
      e.preventDefault()
      router.push(flatResults[activeIndex].href)
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Search</DialogTitle>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search across HQ..."
            className="flex-1 text-sm outline-none placeholder:text-slate-400"
            autoFocus
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
          )}
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {query.length < 2 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              Type to search across leads, products, suppliers…
            </p>
          ) : !loading && flatResults.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              No results for &ldquo;{query}&rdquo;
            </p>
          ) : (
            grouped.map((group) => {
              const Icon = group.meta.icon
              return (
                <div key={group.type}>
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      {group.meta.label}
                    </span>
                  </div>
                  {group.items.map((item) => {
                    const idx = flatResults.indexOf(item)
                    const isActive = idx === activeIndex
                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-slate-50 ${
                          isActive ? 'bg-slate-50' : ''
                        }`}
                        onClick={() => {
                          router.push(item.href)
                          setOpen(false)
                        }}
                        onMouseEnter={() => setActiveIndex(idx)}
                      >
                        <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{item.label}</p>
                          {item.subtitle && (
                            <p className="text-xs text-slate-400 truncate">{item.subtitle}</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        {/* Footer hints */}
        {flatResults.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-4 text-[11px] text-slate-400">
            <span><kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono">↵</kbd> open</span>
            <span><kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono">esc</kbd> close</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
