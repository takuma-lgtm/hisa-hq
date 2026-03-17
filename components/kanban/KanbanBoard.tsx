'use client'

import { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { PIPELINE_STAGES, LEAD_GEN_EDITABLE_STAGES, HANDOFF_STAGE } from '@/lib/constants'
import { validateHandoff } from '@/lib/handoff'
import { createClient } from '@/lib/supabase/client'
import type { Opportunity, Customer, UserRole, OpportunityStage } from '@/types/database'
import KanbanCard from './KanbanCard'
import KanbanColumn from './KanbanColumn'
import HandoffModal from './HandoffModal'

export interface OpportunityCard extends Opportunity {
  customer: Pick<
    Customer,
    | 'cafe_name'
    | 'city'
    | 'country'
    | 'address'
    | 'state'
    | 'zip_code'
    | 'instagram_handle'
    | 'contact_person'
    | 'phone'
    | 'monthly_matcha_usage_kg'
    | 'budget_delivered_price_per_kg'
    | 'budget_currency'
    | 'current_supplier'
    | 'current_supplier_unknown'
    | 'cafe_segment'
    | 'matcha_experience'
    | 'customer_id'
  >
}

interface KanbanBoardProps {
  initialOpportunities: OpportunityCard[]
  userRole: UserRole
}

export default function KanbanBoard({ initialOpportunities, userRole }: KanbanBoardProps) {
  const [opportunities, setOpportunities] = useState(initialOpportunities)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Handoff modal state
  const [pendingHandoff, setPendingHandoff] = useState<{
    oppId: string
    fromStage: OpportunityStage
  } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const oppsByStage = PIPELINE_STAGES.reduce(
    (acc, stage) => {
      acc[stage.id] = opportunities.filter((o) => o.stage === stage.id)
      return acc
    },
    {} as Record<OpportunityStage, OpportunityCard[]>,
  )

  const activeOpp = activeId ? opportunities.find((o) => o.opportunity_id === activeId) : null

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const oppId = active.id as string
    const newStage = over.id as OpportunityStage
    const opp = opportunities.find((o) => o.opportunity_id === oppId)
    if (!opp || opp.stage === newStage) return

    // Role gate: lead_gen can only move within LEAD_GEN_EDITABLE_STAGES
    if (userRole === 'lead_gen' && !LEAD_GEN_EDITABLE_STAGES.includes(newStage)) {
      setError('Your role cannot move opportunities past the handoff stage.')
      return
    }

    // Handoff gate: validate customer completeness before advancing to sample_approved
    if (newStage === HANDOFF_STAGE) {
      const validationErrors = validateHandoff(opp.customer as Customer)
      if (validationErrors.length > 0) {
        const groups = [...new Set(validationErrors.map((e) => e.group))]
        setError(
          `Complete missing fields before handoff: ${validationErrors.map((e) => e.message).slice(0, 3).join(', ')}${validationErrors.length > 3 ? ` +${validationErrors.length - 3} more` : ''}.`,
        )
        return
      }
      // Show handoff modal to pick the closer
      setPendingHandoff({ oppId, fromStage: opp.stage })
      return
    }

    await applyStageChange(oppId, opp.stage, newStage)
  }

  async function applyStageChange(
    oppId: string,
    fromStage: OpportunityStage,
    newStage: OpportunityStage,
  ) {
    // Optimistic update
    setOpportunities((prev) =>
      prev.map((o) => (o.opportunity_id === oppId ? { ...o, stage: newStage } : o)),
    )
    setError(null)

    const supabase = createClient()
    const { error: dbError } = await supabase
      .from('opportunities')
      .update({ stage: newStage })
      .eq('opportunity_id', oppId)

    if (dbError) {
      setOpportunities((prev) =>
        prev.map((o) => (o.opportunity_id === oppId ? { ...o, stage: fromStage } : o)),
      )
      setError('Failed to update stage. Please try again.')
    }
  }

  async function handleHandoffConfirm(assignedTo: string) {
    if (!pendingHandoff) return
    const { oppId, fromStage } = pendingHandoff
    setPendingHandoff(null)

    // Optimistic update
    setOpportunities((prev) =>
      prev.map((o) =>
        o.opportunity_id === oppId ? { ...o, stage: HANDOFF_STAGE, assigned_to: assignedTo } : o,
      ),
    )

    const res = await fetch(`/api/opportunities/${oppId}/handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: assignedTo }),
    })

    if (!res.ok) {
      // Rollback
      setOpportunities((prev) =>
        prev.map((o) => (o.opportunity_id === oppId ? { ...o, stage: fromStage } : o)),
      )
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Handoff failed. Please try again.')
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {error && (
        <div className="mx-4 mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center justify-between">
          <span>{error}</span>
          <button className="ml-2 underline text-xs shrink-0" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto p-4 flex-1 kanban-scroll">
          {PIPELINE_STAGES.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              opportunities={oppsByStage[stage.id]}
            />
          ))}
        </div>

        <DragOverlay>
          {activeOpp ? <KanbanCard opportunity={activeOpp} isDragging /> : null}
        </DragOverlay>
      </DndContext>

      <HandoffModal
        opportunityId={pendingHandoff?.oppId ?? ''}
        open={!!pendingHandoff}
        onOpenChange={(open) => { if (!open) setPendingHandoff(null) }}
        onConfirm={handleHandoffConfirm}
      />
    </div>
  )
}
