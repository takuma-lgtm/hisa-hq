'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Customer } from '@/types/database'
import { formatDate } from '@/lib/utils'
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Loader2,
  Users,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  lead: Customer
  canEdit: boolean
}

type EnrichState = 'idle' | 'enriching' | 'results' | 'saving' | 'success' | 'error'

interface ClayContact {
  name: string
  email: string | null
  title: string | null
  linkedinUrl: string | null
}

interface ClayResults {
  contacts: ClayContact[]
  companySize?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClayEnrichButton({ lead, canEdit }: Props) {
  const router = useRouter()
  const [state, setState] = useState<EnrichState>('idle')
  const [results, setResults] = useState<ClayResults | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx] = useState<number>(0)

  const hasWebsite = !!lead.website_url?.trim()

  if (!canEdit) return null

  // ---- Enrich ----

  async function handleEnrich() {
    setState('enriching')
    setErrorMsg(null)
    setResults(null)
    setSelectedIdx(0)

    try {
      const res = await fetch('/api/leads/clay-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: lead.customer_id,
          websiteUrl: lead.website_url,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setState('error')
        setErrorMsg(data.error ?? 'Clay enrichment failed')
        return
      }

      setResults(data)
      setState('results')
    } catch {
      setState('error')
      setErrorMsg('Network error')
    }
  }

  // ---- Save ----

  async function handleSave() {
    if (!results || results.contacts.length === 0) return

    const contact = results.contacts[selectedIdx]
    if (!contact) return

    setState('saving')
    setErrorMsg(null)

    const body: Record<string, string | null> = {
      customerId: lead.customer_id,
    }

    // Only include fields that have values and don't overwrite existing non-empty fields
    if (contact.name && contact.name !== 'Unknown') {
      body.contact_person = contact.name
    }
    if (contact.email) {
      body.email = contact.email
    }
    if (contact.title) {
      body.contact_title = contact.title
    }
    if (contact.linkedinUrl) {
      body.linkedin_url = contact.linkedinUrl
    }
    if (results.companySize) {
      body.company_size = results.companySize
    }

    try {
      const res = await fetch('/api/leads/enrich/save', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setState('error')
        setErrorMsg(data.error ?? 'Save failed')
        return
      }

      setState('success')
      router.refresh()
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
      setErrorMsg('Network error')
    }
  }

  // ---- Dismiss ----

  function handleDismiss() {
    setState('idle')
    setResults(null)
    setSelectedIdx(0)
  }

  // ---- Render ----

  const isEmpty = results && results.contacts.length === 0

  return (
    <div className="space-y-2 mt-2">
      {/* Idle / trigger button */}
      {(state === 'idle' || state === 'success') && (
        <div>
          <button
            onClick={handleEnrich}
            disabled={!hasWebsite}
            title={!hasWebsite ? 'Add a website URL first' : 'Search Clay for owner/decision-maker contact info'}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 border border-purple-600 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <Users className="w-3.5 h-3.5" />
            Deep Enrich with Clay
          </button>
          {lead.last_enriched_at && (
            <p className="text-[11px] text-slate-400 mt-1">
              Last enriched: {formatDate(lead.last_enriched_at)}
            </p>
          )}
          {!hasWebsite && (
            <p className="text-[11px] text-slate-400 mt-1">
              Add a website URL first
            </p>
          )}
          {state === 'success' && (
            <p className="flex items-center gap-1 text-[11px] text-green-600 mt-1">
              <CheckCircle className="w-3 h-3" /> Contact info saved
            </p>
          )}
        </div>
      )}

      {/* Loading */}
      {state === 'enriching' && (
        <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Searching for owner contact info...
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 text-red-700 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {errorMsg}
          </div>
          <button
            onClick={handleDismiss}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Results */}
      {state === 'results' && results && (
        <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50">
          {isEmpty ? (
            <p className="text-sm text-slate-500">
              No contacts found for this company.
            </p>
          ) : (
            <>
              <p className="text-xs font-medium text-slate-600 flex items-center gap-1">
                <Users className="w-3 h-3" /> Contacts Found
              </p>
              <div className="space-y-2">
                {results.contacts.map((contact, idx) => (
                  <label
                    key={idx}
                    className="flex items-start gap-2 text-xs cursor-pointer p-1.5 rounded hover:bg-slate-100"
                  >
                    <input
                      type="radio"
                      name="clay-contact"
                      checked={selectedIdx === idx}
                      onChange={() => setSelectedIdx(idx)}
                      className="accent-purple-600 mt-0.5"
                    />
                    <div className="min-w-0">
                      <span className="font-medium text-slate-700">
                        {contact.name || 'Unknown'}
                      </span>
                      {contact.title && (
                        <span className="text-slate-500 ml-1">
                          &middot; {contact.title}
                        </span>
                      )}
                      {contact.email && (
                        <p className="text-slate-600 truncate">{contact.email}</p>
                      )}
                      {contact.linkedinUrl && (
                        <a
                          href={contact.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          LinkedIn <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {results.companySize && (
                <p className="text-[11px] text-slate-400">
                  Company size: {results.companySize}
                </p>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {!isEmpty && (
              <button
                onClick={handleSave}
                className="text-xs font-medium px-3 py-1 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
              >
                Save
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Saving */}
      {state === 'saving' && (
        <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Saving contact info...
        </div>
      )}
    </div>
  )
}
