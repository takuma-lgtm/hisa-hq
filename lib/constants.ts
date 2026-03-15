import type { OpportunityStage, CafeSegment, MatchaExperience, CallType, CallOutcome } from '@/types/database'

export const PIPELINE_STAGES: {
  id: OpportunityStage
  label: string
  color: string
  group: 'lead_gen' | 'handoff' | 'closer' | 'terminal'
}[] = [
  { id: 'lead_created',       label: 'Lead Created',       color: 'bg-slate-100 text-slate-700',     group: 'lead_gen' },
  { id: 'outreach_sent',      label: 'Outreach Sent',      color: 'bg-blue-50 text-blue-700',        group: 'lead_gen' },
  { id: 'cafe_replied',       label: 'Cafe Replied',       color: 'bg-indigo-50 text-indigo-700',    group: 'lead_gen' },
  { id: 'get_info',           label: 'Get Info',           color: 'bg-violet-50 text-violet-700',    group: 'lead_gen' },
  { id: 'product_guide_sent', label: 'Product Guide Sent', color: 'bg-purple-50 text-purple-700',    group: 'lead_gen' },
  { id: 'sample_approved',    label: 'Sample Approved',    color: 'bg-yellow-50 text-yellow-800',    group: 'handoff' },
  { id: 'samples_shipped',    label: 'Samples Shipped',    color: 'bg-amber-50 text-amber-700',      group: 'closer' },
  { id: 'samples_delivered',  label: 'Samples Delivered',  color: 'bg-orange-50 text-orange-700',    group: 'closer' },
  { id: 'quote_sent',         label: 'Quote Sent',         color: 'bg-lime-50 text-lime-700',        group: 'closer' },
  { id: 'collect_feedback',   label: 'Collect Feedback',   color: 'bg-teal-50 text-teal-700',        group: 'closer' },
  { id: 'deal_won',           label: 'Deal Won',           color: 'bg-green-50 text-green-700',      group: 'closer' },
  { id: 'payment_received',   label: 'Payment Received',   color: 'bg-emerald-50 text-emerald-700',  group: 'closer' },
  { id: 'first_order',        label: 'First Order',        color: 'bg-sky-50 text-sky-700',          group: 'closer' },
  { id: 'recurring_customer', label: 'Recurring Customer', color: 'bg-cyan-50 text-cyan-700',        group: 'closer' },
  { id: 'disqualified',       label: 'Disqualified',       color: 'bg-red-50 text-red-700',          group: 'terminal' },
  { id: 'lost',               label: 'Lost',               color: 'bg-gray-100 text-gray-500',       group: 'terminal' },
]

export const STAGE_LABEL: Record<OpportunityStage, string> = Object.fromEntries(
  [
    ...PIPELINE_STAGES.map((s) => [s.id, s.label]),
    // Legacy values not shown in Kanban
    ['quote_accepted', 'Quote Accepted'],
    ['internal_review_pending', 'Internal Review'],
    ['invoice_sent', 'Invoice Sent'],
  ],
) as Record<OpportunityStage, string>

/** The stage at which handoff from lead_gen → closer occurs */
export const HANDOFF_STAGE: OpportunityStage = 'sample_approved'

/** Stages that lead_gen can move cards into (closer handles everything after handoff) */
export const LEAD_GEN_EDITABLE_STAGES: OpportunityStage[] = [
  'lead_created',
  'outreach_sent',
  'cafe_replied',
  'get_info',
  'product_guide_sent',
  'sample_approved',
]

/** Stages considered "active" (not terminal) */
export const ACTIVE_STAGES: OpportunityStage[] = PIPELINE_STAGES
  .filter((s) => s.group !== 'terminal')
  .map((s) => s.id)

export const CAFE_SEGMENT_LABELS: Record<CafeSegment, string> = {
  coffee_shop:      'Coffee Shop',
  matcha_specialist: 'Matcha Specialist',
  mixed:            'Mixed (Coffee + Matcha)',
  other:            'Other',
}

export const MATCHA_EXPERIENCE_LABELS: Record<MatchaExperience, string> = {
  new_to_matcha:      'New to Matcha',
  already_uses_matcha: 'Already Uses Matcha',
}

export const CALL_TYPE_LABELS: Record<CallType, string> = {
  discovery:      'Discovery',
  pre_sample:     'Pre-Sample',
  post_delivery:  'Post-Delivery',
  negotiation:    'Negotiation',
  general:        'General',
}

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  not_interested:   'Not Interested',
  follow_up:        'Follow-Up Needed',
  samples_approved: 'Samples Approved',
  deal_closed:      'Deal Closed',
  other:            'Other',
}

export const CAFE_TYPE_LABELS = {
  coffee_shop:            'Coffee Shop',
  matcha_focused:         'Matcha Focused',
  already_serving_matcha: 'Already Serving Matcha',
  new_to_matcha:          'New to Matcha',
  other:                  'Other',
} as const

export const CUSTOMER_STATUS_LABELS = {
  lead:                 'Lead',
  qualified_opportunity: 'Qualified',
  recurring_customer:   'Recurring',
  lost:                 'Lost',
} as const

// ---------------------------------------------------------------------------
// Opportunities table page — subset of stages visible to closers
// ---------------------------------------------------------------------------

export const OPPORTUNITY_TABLE_STAGES: OpportunityStage[] = [
  'sample_approved',
  'samples_shipped',
  'samples_delivered',
  'quote_sent',
  'deal_won',
]

export const OPPORTUNITY_STAGE_LABELS: Record<string, string> = {
  sample_approved: 'Samples',
  samples_shipped: 'Shipped',
  samples_delivered: 'Delivered',
  quote_sent: 'Quote Sent',
  deal_won: 'Won',
  disqualified: 'Disqualified',
  lost: 'Lost',
}

export const OPPORTUNITY_STAGE_COLORS: Record<string, string> = {
  sample_approved: 'bg-amber-50 text-amber-700',
  samples_shipped: 'bg-blue-50 text-blue-700',
  samples_delivered: 'bg-purple-50 text-purple-700',
  quote_sent: 'bg-indigo-50 text-indigo-700',
  deal_won: 'bg-green-50 text-green-700',
  disqualified: 'bg-red-50 text-red-600',
  lost: 'bg-slate-100 text-slate-500',
}
