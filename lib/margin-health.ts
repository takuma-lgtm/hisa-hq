export interface MarginThresholds {
  redProfitUsd: number
  redMarginPct: number
  yellowProfitUsd: number
  yellowMarginPct: number
}

export const DEFAULT_MARGIN_THRESHOLDS: MarginThresholds = {
  redProfitUsd: 150,
  redMarginPct: 15,
  yellowProfitUsd: 330,
  yellowMarginPct: 25,
}

export type MarginHealth = 'green' | 'yellow' | 'red'

export function getMarginHealth(
  grossProfitMargin: number | null,
  grossProfitPerKgUsd: number | null,
  thresholds: MarginThresholds = DEFAULT_MARGIN_THRESHOLDS,
): MarginHealth {
  const marginPct = grossProfitMargin != null ? grossProfitMargin * 100 : null
  const profitUsd = grossProfitPerKgUsd

  // Red: margin < red threshold OR profit < red threshold
  if (
    (marginPct != null && marginPct < thresholds.redMarginPct) ||
    (profitUsd != null && profitUsd < thresholds.redProfitUsd)
  ) {
    return 'red'
  }

  // Green: margin > yellow threshold AND profit > yellow threshold
  if (
    marginPct != null &&
    profitUsd != null &&
    marginPct > thresholds.yellowMarginPct &&
    profitUsd > thresholds.yellowProfitUsd
  ) {
    return 'green'
  }

  // Yellow: everything in between, or missing data
  if (marginPct != null || profitUsd != null) {
    return 'yellow'
  }

  // No data at all
  return 'yellow'
}
