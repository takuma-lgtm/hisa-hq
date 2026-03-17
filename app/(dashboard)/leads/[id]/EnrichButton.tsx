'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Customer } from '@/types/database'
import { formatDate } from '@/lib/utils'
import {
  AlertCircle,
  CheckCircle,
  Globe,
  Loader2,
  Mail,
  Phone,
  Search,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  lead: Customer
  canEdit: boolean
}

type EnrichState = 'idle' | 'enriching' | 'results' | 'saving' | 'success' | 'error'

interface EnrichResults {
  emails: string[]
  phones: string[]
  socialUrls: string[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EnrichButton({ lead, canEdit }: Props) {
  const router = useRouter()
  const [state, setState] = useState<EnrichState>('idle')
  const [results, setResults] = useState<EnrichResults | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Selected values for saving
  const [selectedEmail, setSelectedEmail] = useState<string>('')
  const [selectedPhone, setSelectedPhone] = useState<string>('')
  const [selectedInstagram, setSelectedInstagram] = useState<string>('')

  const hasWebsite = !!lead.website_url?.trim()

  if (!canEdit) return null

  // ---- Enrich ----

  async function handleEnrich() {
    setState('enriching')
    setErrorMsg(null)
    setResults(null)

    try {
      const res = await fetch('/api/leads/apify-enrich', {
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
        setErrorMsg(data.error ?? 'Enrichment failed')
        return
      }

      setResults(data)
      // Pre-select first values
      if (data.emails?.length > 0) setSelectedEmail(data.emails[0])
      if (data.phones?.length > 0) setSelectedPhone(data.phones[0])
      // Pre-select Instagram if found
      const ig = (data.socialUrls ?? []).find((u: string) =>
        u.includes('instagram.com'),
      )
      if (ig) setSelectedInstagram(ig)

      setState('results')
    } catch {
      setState('error')
      setErrorMsg('Network error')
    }
  }

  // ---- Save ----

  async function handleSave() {
    setState('saving')
    setErrorMsg(null)

    const body: Record<string, string | null> = {
      customerId: lead.customer_id,
    }
    if (selectedEmail) body.email = selectedEmail
    if (selectedPhone) body.phone = selectedPhone
    if (selectedInstagram) body.instagram_url = selectedInstagram

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
    setSelectedEmail('')
    setSelectedPhone('')
    setSelectedInstagram('')
  }

  // ---- Render ----

  const isEmpty =
    results &&
    results.emails.length === 0 &&
    results.phones.length === 0 &&
    results.socialUrls.length === 0

  const instagramUrls = (results?.socialUrls ?? []).filter((u) =>
    u.includes('instagram.com'),
  )
  const otherSocialUrls = (results?.socialUrls ?? []).filter(
    (u) => !u.includes('instagram.com'),
  )

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-600 mb-1">
        Contact Enrichment
      </label>

      {/* Idle / trigger button */}
      {(state === 'idle' || state === 'success') && (
        <div>
          <button
            onClick={handleEnrich}
            disabled={!hasWebsite}
            title={!hasWebsite ? 'Add a website URL first' : 'Scan website for contact info'}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <Search className="w-3.5 h-3.5" />
            Find Contact Info
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
          Scanning website for contact info...
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
              No contact info found on this website. Try Deep Enrich with Clay.
            </p>
          ) : (
            <>
              {/* Emails */}
              {results.emails.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Emails
                  </p>
                  <div className="space-y-1">
                    {results.emails.map((email) => (
                      <label
                        key={email}
                        className="flex items-center gap-2 text-xs cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="enrich-email"
                          checked={selectedEmail === email}
                          onChange={() => setSelectedEmail(email)}
                          className="accent-green-600"
                        />
                        <span className="text-slate-700">{email}</span>
                      </label>
                    ))}
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="enrich-email"
                        checked={selectedEmail === ''}
                        onChange={() => setSelectedEmail('')}
                        className="accent-green-600"
                      />
                      <span className="text-slate-400">None</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Phones */}
              {results.phones.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Phone Numbers
                  </p>
                  <div className="space-y-1">
                    {results.phones.map((phone) => (
                      <label
                        key={phone}
                        className="flex items-center gap-2 text-xs cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="enrich-phone"
                          checked={selectedPhone === phone}
                          onChange={() => setSelectedPhone(phone)}
                          className="accent-green-600"
                        />
                        <span className="text-slate-700">{phone}</span>
                      </label>
                    ))}
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="enrich-phone"
                        checked={selectedPhone === ''}
                        onChange={() => setSelectedPhone('')}
                        className="accent-green-600"
                      />
                      <span className="text-slate-400">None</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Instagram */}
              {instagramUrls.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Instagram
                  </p>
                  <div className="space-y-1">
                    {instagramUrls.map((url) => (
                      <label
                        key={url}
                        className="flex items-center gap-2 text-xs cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="enrich-instagram"
                          checked={selectedInstagram === url}
                          onChange={() => setSelectedInstagram(url)}
                          className="accent-green-600"
                        />
                        <span className="text-slate-700 truncate">{url}</span>
                      </label>
                    ))}
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="enrich-instagram"
                        checked={selectedInstagram === ''}
                        onChange={() => setSelectedInstagram('')}
                        className="accent-green-600"
                      />
                      <span className="text-slate-400">None</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Other social URLs (display only) */}
              {otherSocialUrls.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Other Social Links
                  </p>
                  <ul className="space-y-0.5">
                    {otherSocialUrls.map((url) => (
                      <li key={url}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline truncate block"
                        >
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {!isEmpty && (
              <button
                onClick={handleSave}
                disabled={
                  !selectedEmail && !selectedPhone && !selectedInstagram
                }
                className="text-xs font-medium px-3 py-1 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Selected
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
