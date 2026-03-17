'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import type { Customer } from '@/types/database'
import LeadsTable from './LeadsTable'
import DiscoverPanel from './DiscoverPanel'

interface Props {
  leads: Customer[]
  profiles: { id: string; name: string }[]
  outreachStats: Record<string, { lastOutreachDate: string | null; outreachCount: number; daysSinceContact: number | null; latestStatus: string | null }>
  canEdit: boolean
}

function Content({ leads, profiles, outreachStats, canEdit }: Props) {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') || 'leads'

  if (tab === 'discover') {
    return <DiscoverPanel />
  }

  if (leads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        No leads yet. Click &quot;Add Leads&quot; to import your lead list.
      </div>
    )
  }

  return <LeadsTable leads={leads} profiles={profiles} outreachStats={outreachStats} canEdit={canEdit} />
}

export default function LeadsPageContent(props: Props) {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-slate-400">Loading...</div>}>
      <Content {...props} />
    </Suspense>
  )
}
