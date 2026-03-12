'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { MapPin, ArrowRightCircle } from 'lucide-react'
import { HANDOFF_STAGE } from '@/lib/constants'
import type { OpportunityCard } from './KanbanBoard'

interface Props {
  opportunity: OpportunityCard
  isDragging?: boolean
}

export default function KanbanCard({ opportunity: opp, isDragging }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } =
    useSortable({ id: opp.opportunity_id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'bg-white rounded-lg border border-slate-200 p-3 cursor-grab active:cursor-grabbing shadow-sm select-none',
        (isDragging || isSortableDragging) && 'opacity-50 shadow-md ring-2 ring-green-400',
      )}
    >
      <Link
        href={`/opportunities/${opp.opportunity_id}`}
        onClick={(e) => e.stopPropagation()}
        className="block"
      >
        <p className="text-sm font-medium text-slate-900 leading-snug truncate">
          {opp.customer.cafe_name}
        </p>
        {(opp.customer.city || opp.customer.country) && (
          <p className="flex items-center gap-1 text-xs text-slate-400 mt-1">
            <MapPin size={10} />
            {[opp.customer.city, opp.customer.country].filter(Boolean).join(', ')}
          </p>
        )}
        {opp.notes && (
          <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{opp.notes}</p>
        )}
        {opp.stage === HANDOFF_STAGE && (
          <div className="flex items-center gap-1 mt-1.5 text-[10px] font-medium text-amber-700 bg-amber-50 rounded-full px-1.5 py-0.5 w-fit">
            <ArrowRightCircle size={9} />
            Handoff
          </div>
        )}
      </Link>
    </div>
  )
}
