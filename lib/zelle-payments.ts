/**
 * Zelle payment message generation.
 * Reads Zelle email from crm_settings — no API calls.
 */

import type { CrmSetting, InvoiceLineItem } from '@/types/database'

export function getZelleEmail(settings: CrmSetting[]): string {
  return settings.find((s) => s.key === 'zelle_email')?.value ?? 'info@hisamatcha.com'
}

export function generateZelleMessage(
  invoice: {
    invoice_number: string
    amount: number
    line_items_detail: InvoiceLineItem[] | null
  },
  zelleEmail: string,
): string {
  let msg = `Invoice: ${invoice.invoice_number}\nAmount: $${invoice.amount.toFixed(2)}\n`

  if (invoice.line_items_detail?.length) {
    msg += `\nItems:\n`
    for (const item of invoice.line_items_detail) {
      msg += `• ${item.product_name} — ${item.qty_kg}kg × $${item.price_per_kg.toFixed(2)}/kg = $${item.subtotal.toFixed(2)}\n`
    }
  }

  msg += `\nPlease send $${invoice.amount.toFixed(2)} via Zelle to:\n${zelleEmail}\n`
  msg += `\nReference: ${invoice.invoice_number}\n(Please include this in the Zelle memo)\n`
  msg += `\nThank you!\nHisa Matcha`

  return msg
}
