'use client'

import { useEffect, useState, useCallback } from 'react'
import type { InstagramLog } from '@/types/database'

interface Props {
  leadId: string
  canEdit: boolean
  refreshKey: number
  onFollowUp?: (messageText: string) => void
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  no_response: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'No Response' },
  replied: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Replied' },
  interested: { bg: 'bg-green-100', text: 'text-green-700', label: 'Interested' },
  not_interested: { bg: 'bg-red-100', text: 'text-red-700', label: 'Not Interested' },
}

const CHANNEL_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  instagram_dm: { bg: 'bg-pink-100', text: 'text-pink-700', label: 'DM' },
  email: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Email' },
  whatsapp: { bg: 'bg-green-100', text: 'text-green-700', label: 'WhatsApp' },
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function OutreachTimeline({ leadId, canEdit, refreshKey, onFollowUp }: Props) {
  const [messages, setMessages] = useState<(InstagramLog & { channel: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}/messages`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages, refreshKey])

  async function updateStatus(logId: string, status: string) {
    const res = await fetch(`/api/leads/${leadId}/messages/${logId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) fetchMessages()
  }

  async function saveReply(logId: string) {
    if (!replyText.trim()) return
    const res = await fetch(`/api/leads/${leadId}/messages/${logId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply_received: replyText.trim(), status: 'replied' }),
    })
    if (res.ok) {
      setEditingId(null)
      setReplyText('')
      fetchMessages()
    }
  }

  if (loading) {
    return <div className="py-4 text-sm text-muted-foreground">Loading messages...</div>
  }

  if (messages.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No outreach messages yet. Log your first message above.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {messages.map((msg) => {
        const statusStyle = STATUS_STYLES[msg.status] ?? STATUS_STYLES.no_response
        const channelStyle = CHANNEL_STYLES[msg.channel] ?? CHANNEL_STYLES.instagram_dm

        return (
          <div key={msg.log_id} className="relative pl-6 pb-3 border-l-2 border-border last:border-l-0">
            {/* Timeline dot */}
            <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-primary" />

            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              {/* Header: channel + status + time */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${channelStyle.bg} ${channelStyle.text}`}>
                  {channelStyle.label}
                </span>

                {canEdit ? (
                  <select
                    value={msg.status}
                    onChange={(e) => updateStatus(msg.log_id, e.target.value)}
                    className={`px-2 py-0.5 text-xs font-medium rounded-full border-0 cursor-pointer ${statusStyle.bg} ${statusStyle.text}`}
                  >
                    <option value="no_response">No Response</option>
                    <option value="replied">Replied</option>
                    <option value="interested">Interested</option>
                    <option value="not_interested">Not Interested</option>
                  </select>
                ) : (
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                    {statusStyle.label}
                  </span>
                )}

                <span className="text-xs text-muted-foreground ml-auto">
                  {formatDate(msg.created_at)} at {formatTime(msg.created_at)}
                </span>
              </div>

              {/* Sent message */}
              <p className="text-sm whitespace-pre-wrap">{msg.message_sent}</p>

              {/* Reply */}
              {msg.reply_received && (
                <div className="ml-4 pl-3 border-l-2 border-green-200">
                  <p className="text-xs font-medium text-green-700 mb-0.5">Reply received:</p>
                  <p className="text-sm whitespace-pre-wrap">{msg.reply_received}</p>
                </div>
              )}

              {/* Add reply inline */}
              {canEdit && !msg.reply_received && (
                editingId === msg.log_id ? (
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Paste their reply..."
                      className="flex-1 rounded-md border border-border bg-input px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      onKeyDown={(e) => e.key === 'Enter' && saveReply(msg.log_id)}
                    />
                    <button
                      onClick={() => saveReply(msg.log_id)}
                      className="px-2 py-1 text-xs font-medium rounded-md bg-slate-800 text-white hover:bg-slate-900"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setReplyText('') }}
                      className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditingId(msg.log_id)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      + Log reply
                    </button>
                    {onFollowUp && msg.status === 'no_response' && msg.message_sent && (
                      <button
                        onClick={() => onFollowUp(msg.message_sent!)}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Follow Up
                      </button>
                    )}
                  </div>
                )
              )}

              {/* Notes */}
              {msg.notes && (
                <p className="text-xs text-muted-foreground italic">Note: {msg.notes}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
