'use client'

import { useState } from 'react'
import { Trash2, Plus, Copy, Check } from 'lucide-react'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  created_at: string
}

interface Props {
  initialTeam: TeamMember[]
  currentUserId: string
}

export default function TeamManagement({ initialTeam, currentUserId }: Props) {
  const [team, setTeam] = useState(initialTeam)
  const [inviting, setInviting] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'member' })
  const [saving, setSaving] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRoleChange(id: string, newRole: string) {
    const prev = team.find((m) => m.id === id)
    setTeam((t) => t.map((m) => m.id === id ? { ...m, role: newRole } : m))
    const res = await fetch(`/api/team/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    if (!res.ok) {
      setTeam((t) => t.map((m) => m.id === id ? { ...m, role: prev?.role ?? 'member' } : m))
    }
  }

  async function handleRemove(id: string, name: string) {
    if (!confirm(`Remove ${name} from the team? This cannot be undone.`)) return
    const res = await fetch(`/api/team/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTeam((t) => t.filter((m) => m.id !== id))
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error)
        return
      }
      setTeam((t) => [...t, { ...data.user, created_at: new Date().toISOString() }])
      setTempPassword(data.tempPassword)
      setInviteForm({ email: '', name: '', role: 'member' })
    } finally {
      setSaving(false)
    }
  }

  function copyPassword() {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-sm font-semibold text-slate-900 mb-4">Team</h2>

      {/* Team table */}
      <div className="space-y-2">
        {team.map((member) => {
          const isOwner = member.role === 'owner'
          const isSelf = member.id === currentUserId
          return (
            <div key={member.id} className="flex items-center gap-4 py-2 px-3 rounded-lg hover:bg-slate-50">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {member.name}
                  {isSelf && <span className="ml-1.5 text-[10px] text-slate-400">(you)</span>}
                </p>
                <p className="text-xs text-slate-400 truncate">{member.email}</p>
              </div>
              <div className="w-28">
                {isOwner ? (
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">Owner</span>
                ) : (
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value)}
                    className="text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-slate-400 w-full"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </select>
                )}
              </div>
              <div className="w-8">
                {!isOwner && !isSelf && (
                  <button
                    onClick={() => handleRemove(member.id, member.name)}
                    className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                    title="Remove member"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Temp password banner */}
      {tempPassword && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800 font-medium mb-1">Temporary password (share with the new member):</p>
          <div className="flex items-center gap-2">
            <code className="text-sm bg-white px-2 py-1 rounded border border-amber-200 font-mono flex-1">{tempPassword}</code>
            <button onClick={copyPassword} className="p-1.5 text-amber-600 hover:text-amber-800">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Invite form */}
      {inviting ? (
        <form onSubmit={handleInvite} className="mt-4 p-4 border border-slate-200 rounded-lg space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Name"
              value={inviteForm.name}
              onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-slate-400"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-slate-400"
              required
            />
            <select
              value={inviteForm.role}
              onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {saving ? 'Inviting...' : 'Send Invite'}
            </button>
            <button
              type="button"
              onClick={() => { setInviting(false); setError(null); setTempPassword(null) }}
              className="px-4 py-1.5 text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => { setInviting(true); setTempPassword(null) }}
          className="mt-4 flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800 font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          Invite Member
        </button>
      )}
    </div>
  )
}
