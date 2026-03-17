import { MapPin, Instagram, Phone, Package, DollarSign, ArrowRight } from 'lucide-react'
import { CAFE_SEGMENT_LABELS, MATCHA_EXPERIENCE_LABELS } from '@/lib/constants'
import { STAGE_NEXT_ACTION } from '@/lib/handoff'
import type { OpportunityFull, Customer } from '@/types/database'

interface Props {
  opportunity: OpportunityFull
  customer: Customer
}

export default function HandoffSummaryCard({ opportunity, customer }: Props) {
  const nextAction = STAGE_NEXT_ACTION[opportunity.stage]

  return (
    <div className="m-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3">
        Handoff Summary
      </h2>

      {/* Next action */}
      {nextAction && (
        <div className="mb-3 flex gap-2 bg-white rounded-lg p-2.5 border border-green-100">
          <ArrowRight className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
          <p className="text-xs text-green-900 font-medium">{nextAction}</p>
        </div>
      )}

      <div className="space-y-1.5">
        {/* Cafe basics */}
        <Row icon={<Instagram className="w-3 h-3" />}>
          {customer.instagram_handle ?? 'No IG'}
          {customer.contact_person && <> · {customer.contact_person}</>}
        </Row>
        <Row icon={<Phone className="w-3 h-3" />}>
          {customer.phone ?? 'No phone'}
        </Row>
        <Row icon={<MapPin className="w-3 h-3" />}>
          {[customer.address, customer.city, customer.state, customer.zip_code]
            .filter(Boolean)
            .join(', ')}
        </Row>

        {/* Demand */}
        <Row icon={<Package className="w-3 h-3" />}>
          {customer.monthly_matcha_usage_kg != null
            ? `${customer.monthly_matcha_usage_kg} kg/month`
            : 'Usage unknown'}
        </Row>
        <Row icon={<DollarSign className="w-3 h-3" />}>
          {customer.budget_delivered_price_per_kg != null
            ? `Budget $${customer.budget_delivered_price_per_kg}/${customer.budget_currency ?? 'USD'} delivered`
            : 'Budget unknown'}
        </Row>
      </div>

      {/* Segment tags */}
      <div className="flex flex-wrap gap-1 mt-3">
        {customer.cafe_segment && (
          <Tag>{CAFE_SEGMENT_LABELS[customer.cafe_segment]}</Tag>
        )}
        {customer.matcha_experience && (
          <Tag>{MATCHA_EXPERIENCE_LABELS[customer.matcha_experience]}</Tag>
        )}
      </div>

      {/* Market intel highlights */}
      {(customer.likes_about_current || customer.dislikes_about_current || customer.current_supplier) && (
        <div className="mt-3 pt-3 border-t border-green-200 space-y-1">
          {customer.current_supplier && (
            <Intel label="Current supplier">{customer.current_supplier}</Intel>
          )}
          {customer.likes_about_current && (
            <Intel label="Likes">{customer.likes_about_current}</Intel>
          )}
          {customer.dislikes_about_current && (
            <Intel label="Dislikes">{customer.dislikes_about_current}</Intel>
          )}
          {customer.why_switch && (
            <Intel label="Why switch">{customer.why_switch}</Intel>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1.5 text-xs text-green-900">
      <span className="mt-0.5 text-green-600 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block bg-white border border-green-200 text-green-800 text-[10px] font-medium rounded-full px-2 py-0.5">
      {children}
    </span>
  )
}

function Intel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-xs text-green-900">
      <span className="font-medium">{label}: </span>{children}
    </p>
  )
}
