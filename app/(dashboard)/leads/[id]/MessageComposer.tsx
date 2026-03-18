'use client'

import { useState, useEffect } from 'react'
import type { Customer, MessageChannel } from '@/types/database'

interface Props {
  leadId: string
  lead: Customer
  canEdit: boolean
  onMessageSent: () => void
  initialMessage?: string
  leadStage?: string
}

const CHANNELS: { value: MessageChannel; label: string }[] = [
  { value: 'instagram_dm', label: 'Instagram DM' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
]

const WHATSAPP_STAGES = new Set(['replied', 'qualified', 'handed_off'])

function cleanPhoneForWhatsApp(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

function extractIgHandle(url: string): string | null {
  try {
    const cleaned = url.replace(/\/+$/, '')
    const parts = cleaned.split('/')
    const handle = parts[parts.length - 1]
    return handle && handle !== '' ? handle.replace(/^@/, '') : null
  } catch {
    return null
  }
}

export default function MessageComposer({ leadId, lead, canEdit, onMessageSent, initialMessage, leadStage }: Props) {
  const hasIg = !!lead.instagram_url
  const hasPhone = !!(lead as Record<string, unknown>).phone
  const hasEmail = !!(lead as Record<string, unknown>).email
  const phoneNum = (lead as Record<string, unknown>).phone as string | undefined
  const emailAddr = (lead as Record<string, unknown>).email as string | undefined
  const websiteUrl = (lead as Record<string, unknown>).website_url as string | undefined

  const [channel, setChannel] = useState<MessageChannel>('instagram_dm')
  const [message, setMessage] = useState(initialMessage ?? '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  // Email finder state
  const [foundEmail, setFoundEmail] = useState<string | null>(null)
  const [findState, setFindState] = useState<'idle' | 'loading' | 'found' | 'error'>('idle')
  const [emailCandidates, setEmailCandidates] = useState<string[]>([])
  const [findStatusMessage, setFindStatusMessage] = useState<string | null>(null)

  const effectiveEmail = foundEmail ?? emailAddr

  // Update message when initialMessage changes (follow-up pre-fill)
  useEffect(() => {
    if (initialMessage) setMessage(initialMessage)
  }, [initialMessage])

  if (!canEdit) return null

  async function handleFindEmail() {
    setFindState('loading')
    setEmailCandidates([])
    setFindStatusMessage(null)
    try {
      const res = await fetch(`/api/leads/${leadId}/find-email`, { method: 'POST' })
      if (!res.body) throw new Error('No stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'status') setFindStatusMessage(event.message)
            if (event.type === 'result') {
              setEmailCandidates(event.emails ?? [])
              setFindState('found')
            }
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch {
      setFindState('error')
    }
  }

  async function handleSelectEmail(email: string) {
    await fetch('/api/leads/enrich/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: leadId, email }),
    })
    setFoundEmail(email)
    setFindState('idle')
  }

  async function handleSend() {
    if (!message.trim()) return
    setSending(true)
    setError(null)
    setFeedback(null)

    try {
      // Channel-specific behavior
      if (channel === 'instagram_dm') {
        await navigator.clipboard.writeText(message.trim())
        if (lead.instagram_url) {
          const handle = extractIgHandle(lead.instagram_url)
          if (handle) {
            window.open(`https://ig.me/m/${handle}`, '_blank')
            setFeedback('Message copied! Opening Instagram DM...')
          }
        } else {
          const cafeName = lead.cafe_name ?? ''
          window.open(`https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(cafeName)}`, '_blank')
          setFeedback('Message copied! Opening Instagram search...')
        }
      } else if (channel === 'whatsapp') {
        await navigator.clipboard.writeText(message.trim())
        if (phoneNum) {
          const cleaned = cleanPhoneForWhatsApp(phoneNum)
          window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(message.trim())}`, '_blank')
          setFeedback('Opening WhatsApp...')
        } else {
          setFeedback('Message copied! No phone number on file — paste manually in WhatsApp.')
        }
      } else if (channel === 'email') {
        const subject = encodeURIComponent('Matcha Partnership - Hisa Matcha')
        const body = encodeURIComponent(message.trim())
        await navigator.clipboard.writeText(message.trim())
        if (effectiveEmail) {
          window.open(`mailto:${effectiveEmail}?subject=${subject}&body=${body}`, '_blank')
          setFeedback('Opening email client...')
        } else {
          window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
          setFeedback('Message copied! Opening email client...')
        }
      }

      // Log the message
      const res = await fetch(`/api/leads/${leadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_sent: message.trim(),
          channel,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to log message')
      }

      setMessage('')
      onMessageSent()

      // Clear feedback after 3s
      setTimeout(() => setFeedback(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log message')
      setFeedback(null)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Channel selector */}
      <div className="flex gap-1 p-0.5 bg-muted rounded-md w-fit">
        {CHANNELS.filter(c => c.value !== 'whatsapp' || WHATSAPP_STAGES.has(leadStage || '')).map((ch) => (
          <button
            key={ch.value}
            onClick={() => setChannel(ch.value)}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              channel === ch.value
                ? 'bg-white text-foreground shadow-sm font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {ch.label}
          </button>
        ))}
      </div>

      {/* Email finder — only shown on Email tab */}
      {channel === 'email' && !effectiveEmail && findState !== 'found' && (
        <div className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">No email on file.</p>
            <button
              onClick={handleFindEmail}
              disabled={!websiteUrl || findState === 'loading'}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {findState === 'loading' ? 'Searching...' : 'Find email →'}
            </button>
          </div>
          {findState === 'loading' && findStatusMessage && (
            <p className="text-xs text-slate-500 animate-pulse">{findStatusMessage}</p>
          )}
          {!websiteUrl && <p className="text-xs text-slate-400">Add a website URL to this lead first.</p>}
          {findState === 'error' && <p className="text-xs text-red-500">Search failed — try again.</p>}
        </div>
      )}

      {channel === 'email' && !effectiveEmail && findState === 'found' && (
        <div className="rounded border border-slate-200 bg-white p-2.5 space-y-1.5">
          <p className="text-xs font-medium text-slate-600">
            {emailCandidates.length > 0 ? 'Select an email:' : 'No email found.'}
          </p>
          {emailCandidates.map(email => (
            <button
              key={email}
              onClick={() => handleSelectEmail(email)}
              className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-slate-50 border border-slate-100 text-blue-600 font-medium"
            >
              {email}
            </button>
          ))}
          <button onClick={() => setFindState('idle')} className="text-xs text-slate-400 hover:text-slate-600">
            ← Back
          </button>
        </div>
      )}

      {channel === 'email' && effectiveEmail && (
        <div className="flex items-center gap-2 text-xs bg-green-50 text-green-700 px-2.5 py-1.5 rounded">
          <span>Sending to: <strong>{effectiveEmail}</strong></span>
          {foundEmail && (
            <button
              onClick={() => { setFoundEmail(null); setFindState('idle') }}
              className="ml-auto text-green-500 hover:text-green-700"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Message textarea */}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={`Write a message to ${lead.cafe_name ?? 'this lead'}...`}
        rows={3}
        className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
      />


      {/* Feedback */}
      {feedback && <p className="text-sm text-green-600 font-medium">{feedback}</p>}

      {/* Error */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Send button */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {channel === 'instagram_dm' ? 'Opens IG DM + copies message' : channel === 'whatsapp' ? 'Opens WhatsApp with pre-filled message' : effectiveEmail ? `Sending to ${effectiveEmail}` : 'Opens email client (no address)'}
        </p>
        <button
          onClick={handleSend}
          disabled={sending || !message.trim()}
          className="px-4 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  )
}
