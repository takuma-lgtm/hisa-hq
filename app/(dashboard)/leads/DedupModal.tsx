'use client'

import type { DiscoveredProspect } from '@/types/database'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  open: boolean
  onClose: () => void
  runId: string
  prospects: DiscoveredProspect[]
  source: string
  onImport: (skipDuplicates: boolean) => void
  importing: boolean
}

export default function DedupModal({ open, onClose, prospects, source, onImport, importing }: Props) {
  const duplicates = prospects.filter(p => p.is_duplicate)
  const nonDuplicates = prospects.filter(p => !p.is_duplicate)

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Results</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Found <strong>{prospects.length}</strong> prospects from {source} search.
          </p>

          {duplicates.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm font-medium text-amber-800 mb-2">
                {duplicates.length} duplicate{duplicates.length > 1 ? 's' : ''} found (already in your leads):
              </p>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {duplicates.map(d => (
                  <li key={d.prospect_id} className="text-xs text-amber-700">
                    {d.cafe_name} {d.city ? `(${d.city})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {duplicates.length === 0 && (
            <p className="text-sm text-green-600">No duplicates found. All prospects are new.</p>
          )}

          <div className="flex flex-col gap-2 pt-2">
            {duplicates.length > 0 ? (
              <>
                <button
                  onClick={() => onImport(true)}
                  disabled={importing}
                  className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50"
                >
                  {importing ? 'Importing...' : `Skip Duplicates & Import ${nonDuplicates.length}`}
                </button>
                <button
                  onClick={() => onImport(false)}
                  disabled={importing}
                  className="w-full px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Import All {prospects.length} (including duplicates)
                </button>
              </>
            ) : (
              <button
                onClick={() => onImport(false)}
                disabled={importing}
                className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50"
              >
                {importing ? 'Importing...' : `Import ${prospects.length} Leads`}
              </button>
            )}
            <button
              onClick={onClose}
              disabled={importing}
              className="w-full px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
