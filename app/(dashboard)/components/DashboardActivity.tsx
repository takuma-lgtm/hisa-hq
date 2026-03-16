import Link from 'next/link'
import type { ReactNode } from 'react'

export interface ActivityItem {
  icon: ReactNode
  description: string
  timestamp: string
  href?: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function DashboardActivity({ activities }: { activities: ActivityItem[] }) {
  if (activities.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Recent Activity</h2>
        <p className="text-xs text-slate-400">No recent activity</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-sm font-semibold text-slate-900 mb-3">Recent Activity</h2>
      <div className="space-y-1">
        {activities.map((item, i) => {
          const content = (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
              <span className="shrink-0 text-sm">{item.icon}</span>
              <span className="text-sm text-slate-700 truncate flex-1">{item.description}</span>
              <span className="text-xs text-slate-400 shrink-0">{timeAgo(item.timestamp)}</span>
            </div>
          )

          return item.href ? (
            <Link key={i} href={item.href}>{content}</Link>
          ) : (
            <div key={i}>{content}</div>
          )
        })}
      </div>
    </div>
  )
}
