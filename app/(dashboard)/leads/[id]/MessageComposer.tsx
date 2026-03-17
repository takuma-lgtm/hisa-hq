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

  const [channel, setChannel] = useState<MessageChannel>('instagram_dm')
  const [message, setMessage] = useState(initialMessage ?? '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  // Update message when initialMessage changes (follow-up pre-fill)
  useEffect(() => {
    if (initialMessage) setMessage(initialMessage)
  }, [initialMessage])

  if (!canEdit) return null

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
        if (emailAddr) {
          window.open(`mailto:${emailAddr}?subject=${subject}&body=${body}`, '_blank')
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
