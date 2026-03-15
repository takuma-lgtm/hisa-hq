import type { Customer } from '@/types/database'

export interface QualificationItem {
  key: string
  label: string
  filled: boolean
}

export interface QualificationProgress {
  filled: number
  total: 3
  items: QualificationItem[]
  complete: boolean
}

/**
 * Checks whether all 4 qualification fields are filled.
 */
export function isFullyQualified(
  customer: Pick<Customer, 'qualified_products' | 'qualified_volume_kg' | 'qualified_budget'>,
): boolean {
  return (
    !!customer.qualified_products?.trim() &&
    customer.qualified_volume_kg != null &&
    customer.qualified_volume_kg > 0 &&
    !!customer.qualified_budget?.trim()
  )
}

/**
 * Returns detailed qualification progress for UI display.
 */
export function qualificationProgress(
  customer: Pick<Customer, 'qualified_products' | 'qualified_volume_kg' | 'qualified_budget'>,
): QualificationProgress {
  const items: QualificationItem[] = [
    {
      key: 'qualified_products',
      label: 'Products interested in',
      filled: !!customer.qualified_products?.trim(),
    },
    {
      key: 'qualified_volume_kg',
      label: 'Est. monthly volume (kg)',
      filled: customer.qualified_volume_kg != null && customer.qualified_volume_kg > 0,
    },
    {
      key: 'qualified_budget',
      label: 'Budget range',
      filled: !!customer.qualified_budget?.trim(),
    },
  ]

  const filled = items.filter((i) => i.filled).length

  return { filled, total: 3, items, complete: filled === 3 }
}

/**
 * Whether the current lead_stage should auto-advance to 'qualified'
 * when all qualification fields are filled.
 * Only auto-advances from 'replied' — not from later stages.
 */
export function shouldAutoAdvanceToQualified(currentStage: string): boolean {
  return currentStage === 'replied'
}
