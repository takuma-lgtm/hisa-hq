import Link from 'next/link'
import { OPPORTUNITY_STAGE_LABELS, OPPORTUNITY_STAGE_COLORS } from '@/lib/constants'
import type { OpportunityStage } from '@/types/database'

interface Props {
  stageCounts: Record<string, number>
  wonThisMonth: number
  lostThisMonth: number
}

const PIPELINE_STAGES: OpportunityStage[] = [
  'sample_approved',
  'samples_shipped',
  'samples_delivered',
  'quote_sent',
  'deal_won',
]

export default function DashboardPipeline({ stageCounts, wonThisMonth, lostThisMonth }: Props) {
  const total = PIPELINE_STAGES.reduce((sum, s) => sum + (stageCounts[s] ?? 0), 0)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-sm font-semibold text-slate-900 mb-3">Pipeline Overview</h2>

      {/* Horizontal bar */}
      {total > 0 ? (
        <div className="flex rounded-lg overflow-hidden h-9 mb-3">
          {PIPELINE_STAGES.map((stage) => {
            const count = stageCounts[stage] ?? 0
            if (count === 0) return null
            const pct = (count / total) * 100
            const colorClass = OPPORTUNITY_STAGE_COLORS[stage] ?? 'bg-slate-200 text-slate-700'
            return (
              <Link
                key={stage}
                href={`/opportunities?stage=${stage}`}
                className={`${colorClass} flex items-center justify-center text-xs font-medium hover:opacity-80 transition-opacity`}
                style={{ width: `${Math.max(pct, 12)}%` }}
                title={`${OPPORTUNITY_STAGE_LABELS[stage]}: ${count}`}
              >
                {count}
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="h-9 rounded-lg bg-slate-100 flex items-center justify-center text-xs text-slate-400 mb-3">
          No active opportunities
        </div>
      )}

      {/* Labels */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500 mb-4">
        {PIPELINE_STAGES.map((stage) => {
          const count = stageCounts[stage] ?? 0
          return (
            <span key={stage} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${(OPPORTUNITY_STAGE_COLORS[stage] ?? 'bg-slate-300').split(' ')[0]}`} />
              {OPPORTUNITY_STAGE_LABELS[stage]}: {count}
            </span>
          )
        })}
      </div>

      {/* Stats */}
      <div className="flex gap-6 text-xs">
        <span className="text-slate-500">
          Won this month: <span className="font-medium text-green-600">{wonThisMonth}</span>
        </span>
        <span className="text-slate-500">
          Lost this month: <span className="font-medium text-red-600">{lostThisMonth}</span>
        </span>
      </div>
    </div>
  )
}
