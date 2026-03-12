import type { Customer } from '@/types/database'

export interface HandoffError {
  field: string
  message: string
  group: 'cafe_basics' | 'demand' | 'market_intel' | 'segment'
}

/**
 * Validates that a customer record has all required fields before the
 * lead_gen → closer handoff can occur (stage: sample_approved).
 *
 * Returns an empty array if all checks pass; otherwise returns the list
 * of validation errors grouped by category.
 */
export function validateHandoff(customer: Customer): HandoffError[] {
  const errors: HandoffError[] = []

  const push = (field: string, message: string, group: HandoffError['group']) =>
    errors.push({ field, message, group })

  // --- Group 1: Cafe basics (all required) ---
  if (!customer.cafe_name?.trim())
    push('cafe_name', 'Cafe name', 'cafe_basics')
  if (!customer.address?.trim())
    push('address', 'Street address', 'cafe_basics')
  if (!customer.city?.trim())
    push('city', 'City', 'cafe_basics')
  if (!customer.state?.trim())
    push('state', 'State', 'cafe_basics')
  if (!customer.zip_code?.trim())
    push('zip_code', 'ZIP / postal code', 'cafe_basics')
  if (!customer.country?.trim())
    push('country', 'Country', 'cafe_basics')
  if (!customer.instagram_handle?.trim())
    push('instagram_handle', 'Instagram handle', 'cafe_basics')
  if (!customer.contact_person?.trim())
    push('contact_person', 'Point-of-contact name', 'cafe_basics')
  if (!customer.phone?.trim())
    push('phone', 'Phone number', 'cafe_basics')

  // --- Group 2: Demand (required) ---
  if (!customer.monthly_matcha_usage_kg)
    push('monthly_matcha_usage_kg', 'Estimated monthly usage (kg)', 'demand')
  if (!customer.budget_delivered_price_per_kg)
    push('budget_delivered_price_per_kg', 'Budget delivered price/kg', 'demand')

  // --- Group 3: Market intel ---
  // current_supplier required unless current_supplier_unknown is checked
  if (!customer.current_supplier?.trim() && !customer.current_supplier_unknown)
    push('current_supplier', 'Current supplier (or check "Unknown")', 'market_intel')

  // --- Group 4: Cafe segment (both dimensions required) ---
  if (!customer.cafe_segment)
    push('cafe_segment', 'Cafe type (coffee shop / matcha specialist / mixed)', 'segment')
  if (!customer.matcha_experience)
    push('matcha_experience', 'Matcha experience (new vs already uses)', 'segment')

  return errors
}

/** Returns true when the customer is ready for handoff. */
export function isHandoffReady(customer: Customer): boolean {
  return validateHandoff(customer).length === 0
}

/** Count how many of the required handoff fields are complete (for progress bar). */
export function handoffProgress(customer: Customer): { completed: number; total: number } {
  const checks = [
    Boolean(customer.cafe_name?.trim()),
    Boolean(customer.address?.trim()),
    Boolean(customer.city?.trim()),
    Boolean(customer.state?.trim()),
    Boolean(customer.zip_code?.trim()),
    Boolean(customer.country?.trim()),
    Boolean(customer.instagram_handle?.trim()),
    Boolean(customer.contact_person?.trim()),
    Boolean(customer.phone?.trim()),
    Boolean(customer.monthly_matcha_usage_kg),
    Boolean(customer.budget_delivered_price_per_kg),
    Boolean(customer.current_supplier?.trim() || customer.current_supplier_unknown),
    Boolean(customer.cafe_segment),
    Boolean(customer.matcha_experience),
  ]
  return { completed: checks.filter(Boolean).length, total: checks.length }
}

/** Auto-generated next action text shown in the HandoffSummaryCard per stage. */
export const STAGE_NEXT_ACTION: Partial<Record<string, string>> = {
  sample_approved:    'Ship samples from US warehouse. Confirm delivery address with cafe.',
  samples_shipped:    'Track shipment. Prepare discovery call questions for post-delivery follow-up.',
  samples_delivered:  'Send formal quote today. Reference the budget price they mentioned.',
  quote_sent:         'Follow up in 3–5 days if no response. Log call outcomes.',
  collect_feedback:   'Ask about tasting results and specific preferences. Adjust quote if needed.',
  deal_won:           'Request payment. Send invoice or payment link.',
  payment_received:   'Confirm payment cleared. Coordinate first order shipment.',
  first_order:        'Confirm delivery of first order. Set up recurring order cadence.',
  recurring_customer: 'Schedule check-in. Discuss next shipment timing and volume.',
}
