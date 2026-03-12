'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

interface HandoffModalProps {
  opportunityId: string
  onConfirm: (closerId: string) => void
  onCancel: () => void
}

export default function HandoffModal({ onConfirm, onCancel }: HandoffModalProps) {
  const [closers, setClosers] = useState<Pick<Profile, 'id' | 'name' | 'role'>[]>([])
  const [selected, setSelected] = useState<string>('')

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('id, name, role')
      .in('role', ['closer', 'admin'])
      .then(({ data }) => {
        if (data) setClosers(data)
        if (data?.length === 1) setSelected(data[0].id)
      })
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Confirm Handoff</h2>
        <p className="text-sm text-gray-500 mb-4">
          Assign this opportunity to a closer. They will be notified immediately.
        </p>

        <label className="block text-xs font-medium text-gray-700 mb-1">Assign to</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-5"
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

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected}
            className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm Handoff
          </button>
        </div>
      </div>
    </div>
  )
}
