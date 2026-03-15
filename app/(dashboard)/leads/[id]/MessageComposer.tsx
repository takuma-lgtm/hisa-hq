'use client'

import { useState, useEffect } from 'react'
import type { Customer, MessageChannel } from '@/types/database'

interface Props {
  leadId: string
  lead: Customer
  canEdit: boolean
  onMessageSent: () => void
  initialMessage?: string
}

const CHANNELS: { value: MessageChannel; label: string }[] = [
  { value: 'instagram_dm', label: 'Instagram DM' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
]

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

export default function MessageComposer({ leadId, lead, canEdit, onMessageSent, initialMessage }: Props) {
  const hasIg = !!lead.instagram_url
  const hasPhone = !!(lead as Record<string, unknown>).phone
  const hasEmail = !!(lead as Record<string, unknown>).email
  const phoneNum = (lead as Record<string, unknown>).phone as string | undefined
  const emailAddr = (lead as Record<string, unknown>).email as string | undefined

  const defaultChannel: MessageChannel = hasIg ? 'instagram_dm' : hasPhone ? 'whatsapp' : hasEmail ? 'email' : 'instagram_dm'

  const [channel, setChannel] = useState<MessageChannel>(defaultChannel)
  const [message, setMessage] = useState(initialMessage ?? '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  // Update message when initialMessage changes (follow-up pre-fill)
  useEffect(() => {
    if (initialMessage) setMessage(initialMessage)
  }, [initialMessage])

  if (!canEdit) return null

  // No contact info fallback
  if (!hasIg && !hasPhone && !hasEmail) {
    const cafeName = lead.cafe_name ?? ''
    const city = lead.city ?? ''
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
        <p className="text-sm text-amber-800 font-medium">No Instagram or email found for this lead.</p>
        <div className="flex gap-2">
          <a
            href={`https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(cafeName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-pink-100 text-pink-700 hover:bg-pink-200 transition-colors"
          >
            Search Instagram
          </a>
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(`${cafeName} ${city} instagram`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
          >
            Search Google
          </a>
        </div>
      </div>
    )
  }

  async function handleSend() {
    if (!message.trim()) return
    setSending(true)
    setError(null)
    setFeedback(null)

    try {
      // Channel-specific behavior
      if (channel === 'instagram_dm' && lead.instagram_url) {
        const handle = extractIgHandle(lead.instagram_url)
        if (handle) {
          await navigator.clipboard.writeText(message.trim())
          window.open(`https://ig.me/m/${handle}`, '_blank')
          setFeedback('Message copied to clipboard! Opening Instagram...')
        }
      } else if (channel === 'whatsapp' && phoneNum) {
        const cleaned = cleanPhoneForWhatsApp(phoneNum)
        await navigator.clipboard.writeText(message.trim())
        window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(message.trim())}`, '_blank')
        setFeedback('Opening WhatsApp...')
      } else if (channel === 'email' && emailAddr) {
        const subject = encodeURIComponent('Matcha Partnership - Hisa Matcha')
        const body = encodeURIComponent(message.trim())
        window.open(`mailto:${emailAddr}?subject=${subject}&body=${body}`, '_blank')
        setFeedback('Opening email client...')
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

  const igDisabled = !hasIg
  const waDisabled = !hasPhone
  const emailDisabled = !hasEmail

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Channel selector */}
      <div className="flex gap-1 p-0.5 bg-muted rounded-md w-fit">
        {CHANNELS.map((ch) => {
          const disabled = ch.value === 'instagram_dm' ? igDisabled : ch.value === 'whatsapp' ? waDisabled : emailDisabled
          return (
            <button
              key={ch.value}
              onClick={() => !disabled && setChannel(ch.value)}
              disabled={disabled}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                channel === ch.value
                  ? 'bg-white text-foreground shadow-sm font-medium'
                  : disabled
                    ? 'text-muted-foreground/40 cursor-not-allowed'
                    : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {ch.label}
            </button>
          )
        })}
      </div>

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
          {channel === 'instagram_dm' ? 'Opens IG DM + copies message' : channel === 'whatsapp' ? 'Opens WhatsApp with pre-filled message' : 'Opens email client'}
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
