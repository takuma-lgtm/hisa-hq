/**
 * Wise bank transfer details and invoice message generation.
 * Reads bank details from crm_settings — no Wise API calls.
 */

import type { CrmSetting, InvoiceLineItem } from '@/types/database'

export interface WiseBankDetails {
  currency: string
  accountHolder: string
  bankName: string
  // USD
  routingNumber?: string
  accountNumber?: string
  // GBP
  sortCode?: string
  // EUR
  iban?: string
  bic?: string
}

function findSetting(settings: CrmSetting[], key: string): string {
  return settings.find((s) => s.key === key)?.value ?? ''
}

export function getWiseBankDetails(currency: string, settings: CrmSetting[]): WiseBankDetails | null {
  const cur = currency.toLowerCase()

  if (cur === 'usd') {
    const accountHolder = findSetting(settings, 'wise_usd_account_holder')
    if (!accountHolder) return null
    return {
      currency: 'USD',
      accountHolder,
      bankName: findSetting(settings, 'wise_usd_bank_name'),
      routingNumber: findSetting(settings, 'wise_usd_routing_number'),
      accountNumber: findSetting(settings, 'wise_usd_account_number'),
    }
  }

  if (cur === 'gbp') {
    const accountHolder = findSetting(settings, 'wise_gbp_account_holder')
    if (!accountHolder) return null
    return {
      currency: 'GBP',
      accountHolder,
      bankName: findSetting(settings, 'wise_gbp_bank_name'),
      sortCode: findSetting(settings, 'wise_gbp_sort_code'),
      accountNumber: findSetting(settings, 'wise_gbp_account_number'),
    }
  }

  if (cur === 'eur') {
    const accountHolder = findSetting(settings, 'wise_eur_account_holder')
    if (!accountHolder) return null
    return {
      currency: 'EUR',
      accountHolder,
      bankName: findSetting(settings, 'wise_eur_bank_name'),
      iban: findSetting(settings, 'wise_eur_iban'),
      bic: findSetting(settings, 'wise_eur_bic'),
    }
  }

  return null
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', GBP: '£', EUR: '€' }

export function generateWiseInvoiceMessage(
  invoice: {
    invoice_number: string
    due_date: string | null
    amount: number
    currency: string
    line_items_detail: InvoiceLineItem[] | null
    created_at: string
  },
  bankDetails: WiseBankDetails,
  customer: { cafe_name: string | null; address: string | null },
): string {
  const sym = CURRENCY_SYMBOLS[invoice.currency] ?? invoice.currency + ' '
  const date = new Date(invoice.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const dueDate = invoice.due_date
    ? new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Upon receipt'

  let msg = `Invoice: ${invoice.invoice_number}\nDate: ${date}\nDue: ${dueDate}\n`

  if (customer.cafe_name || customer.address) {
    msg += `\nBill To:\n`
    if (customer.cafe_name) msg += `${customer.cafe_name}\n`
    if (customer.address) msg += `${customer.address}\n`
  }

  if (invoice.line_items_detail?.length) {
    msg += `\nItems:\n`
    for (const item of invoice.line_items_detail) {
      msg += `• ${item.product_name} — ${item.qty_kg}kg × ${sym}${item.price_per_kg.toFixed(2)}/kg = ${sym}${item.subtotal.toFixed(2)}\n`
    }
  }

  msg += `\nTotal: ${sym}${invoice.amount.toFixed(2)} ${invoice.currency}\n`

  msg += `\nPayment Details:\nPlease transfer to:\nAccount Holder: ${bankDetails.accountHolder}\nBank: ${bankDetails.bankName}\n`

  if (bankDetails.routingNumber) msg += `Routing: ${bankDetails.routingNumber}\nAccount: ${bankDetails.accountNumber}\n`
  if (bankDetails.sortCode) msg += `Sort Code: ${bankDetails.sortCode}\nAccount: ${bankDetails.accountNumber}\n`
  if (bankDetails.iban) msg += `IBAN: ${bankDetails.iban}\nBIC: ${bankDetails.bic}\n`

  msg += `\nReference: ${invoice.invoice_number}\n(Please include this reference so we can match your payment)\n`
  msg += `\nThank you for your business!\nHisa Matcha\ninfo@hisamatcha.com`

  return msg
}
