'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface HandoffModalProps {
  opportunityId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (closerId: string) => void
}

export default function HandoffModal({ open, onOpenChange, onConfirm }: HandoffModalProps) {
  const [closers, setClosers] = useState<Pick<Profile, 'id' | 'name' | 'role'>[]>([])
  const [selected, setSelected] = useState<string>('')

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('id, name, role')
      .in('role', ['closer', 'admin'])
      .then(({ data }) => {
        if (data) setClosers(data)
        if (data?.length === 1) setSelected(data[0].id)
      })
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm Handoff</DialogTitle>
          <DialogDescription>
            Assign this opportunity to a closer. They will be notified immediately.
          </DialogDescription>
        </DialogHeader>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Assign to</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Select a closer…</option>
            {closers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.role})
              </option>
            ))}
          </select>
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected}
            className="px-4 py-2 text-sm rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm Handoff
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
