'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Suspense } from 'react'

function TabButtons() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = searchParams.get('tab') || 'leads'

  function setTab(newTab: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (newTab === 'leads') {
      params.delete('tab')
    } else {
      params.set('tab', newTab)
    }
    router.push(`/leads?${params.toString()}`)
  }

  return (
    <div className="flex gap-4 px-6 border-b border-slate-200 shrink-0">
      {[
        { key: 'leads', label: 'Leads' },
        { key: 'discover', label: 'Discover' },
      ].map(t => (
        <button
          key={t.key}
          className={cn(
            'pb-2.5 pt-3 text-sm font-medium border-b-2 transition-colors',
            tab === t.key
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-slate-500 hover:text-slate-700',
          )}
          onClick={() => setTab(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export default function LeadsTabSwitcher() {
  return (
    <Suspense fallback={<div className="h-10 border-b border-slate-200" />}>
      <TabButtons />
    </Suspense>
  )
}

export function useLeadsTab() {
  const searchParams = useSearchParams()
  return searchParams.get('tab') || 'leads'
}
