import Link from 'next/link'

export interface AttentionItem {
  icon: string
  label: string
  href: string
}

export default function DashboardNeedsAttention({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Needs Attention</h2>
        <p className="text-sm text-green-600 font-medium">All caught up! &#10003;</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-sm font-semibold text-slate-900 mb-3">Needs Attention</h2>
      <div className="space-y-1">
        {items.map((item, i) => (
          <Link
            key={i}
            href={item.href}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors text-sm text-slate-700"
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
