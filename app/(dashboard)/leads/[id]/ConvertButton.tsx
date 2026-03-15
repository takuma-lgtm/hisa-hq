'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Customer } from '@/types/database'

interface Props {
  lead: Customer
  canEdit: boolean
}

export default function ConvertButton({ lead, canEdit }: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Show for replied and qualified leads
  if (!canEdit || (lead.lead_stage !== 'qualified' && lead.lead_stage !== 'replied')) return null

  async function handleConvert() {
    setConverting(true)
    setError(null)

    try {
      const res = await fetch(`/api/leads/${lead.customer_id}/convert`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409 && data.opportunity_id) {
          router.push(`/opportunities?selected=${data.opportunity_id}`)
          return
        }
        throw new Error(data.error || 'Conversion failed')
      }

      router.push(`/opportunities?selected=${data.opportunity_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed')
      setConverting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full px-4 py-2 text-sm font-medium rounded-md transition-colors bg-green-600 text-white hover:bg-green-700"
      >
        Convert to Opportunity
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !converting && setShowModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-semibold">
              Convert {lead.cafe_name} to an Opportunity?
            </h3>

            <div className="text-sm space-y-3">
              {/* Qualification summary */}
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                <span className="text-slate-400">Products:</span>
                <span className="text-slate-700">{lead.qualified_products || '—'}</span>
                <span className="text-slate-400">Volume:</span>
                <span className="text-slate-700">{lead.qualified_volume_kg ? `${lead.qualified_volume_kg} kg/month` : '—'}</span>
                <span className="text-slate-400">Budget:</span>
                <span className="text-slate-700">{lead.qualified_budget || '—'}</span>
              </div>

              <p className="text-slate-500">
                This will move the lead to the Opportunities pipeline.
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                disabled={converting}
                className="px-4 py-2 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConvert}
                disabled={converting}
                className="px-4 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {converting ? 'Converting...' : 'Convert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
