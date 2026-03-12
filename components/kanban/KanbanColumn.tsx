'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import type { OpportunityStage } from '@/types/database'
import type { OpportunityCard } from './KanbanBoard'
import KanbanCard from './KanbanCard'

interface Props {
  stage: { id: OpportunityStage; label: string; color: string }
  opportunities: OpportunityCard[]
}

export default function KanbanColumn({ stage, opportunities }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div className="flex flex-col w-60 shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap', stage.color)}>
            {stage.label}
          </span>
        </div>
        <span className="text-xs text-slate-400 shrink-0 ml-1">{opportunities.length}</span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col gap-2 flex-1 rounded-xl p-2 min-h-[120px] transition-colors',
          isOver ? 'bg-slate-100' : 'bg-slate-50',
        )}
      >
        <SortableContext
          items={opportunities.map((o) => o.opportunity_id)}
          strategy={verticalListSortingStrategy}
        >
          {opportunities.map((opp) => (
            <KanbanCard key={opp.opportunity_id} opportunity={opp} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
