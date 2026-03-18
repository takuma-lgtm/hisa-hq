"use client";

import StepsProgress from "@/components/ui/steps";
import type { OpportunityStage } from "@/types/database";

// Maps each pipeline stage to a 0-based phase index (0–3)
const STAGE_TO_STEP: Partial<Record<OpportunityStage, number>> = {
  // Phase 0 — Outreach
  lead_created:       0,
  outreach_sent:      0,
  cafe_replied:       0,
  get_info:           0,
  product_guide_sent: 0,
  // Phase 1 — Handoff
  sample_approved:    1,
  // Phase 2 — Sampling
  samples_shipped:    2,
  samples_delivered:  2,
  // Phase 3 — Closing
  quote_sent:         3,
  collect_feedback:   3,
  deal_won:           3,
  payment_received:   3,
  first_order:        3,
  recurring_customer: 3,
};

interface OpportunityProgressProps {
  stage: OpportunityStage;
}

export default function OpportunityProgress({ stage }: OpportunityProgressProps) {
  // Terminal stages (disqualified, lost) don't show a progress bar
  if (stage === "disqualified" || stage === "lost") return null;

  const currentStep = STAGE_TO_STEP[stage] ?? 0;

  return (
    <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/60">
      <StepsProgress currentStep={currentStep} />
    </div>
  );
}
