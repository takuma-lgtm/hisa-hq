'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CrmSetting, InvoiceLineItem, InvoiceWithDetails, OpportunityStage } from '@/types/database'
import InvoiceCreator from '@/components/invoice/InvoiceCreator'
import InvoiceCard from '@/components/invoice/InvoiceCard'
import type { CustomerInfo } from '@/components/invoice/InvoiceCreator'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Proposal {
  proposal_id: string
  default_currency: string
  items: {
    item_id: string
    product_id: string
    price_per_kg: number
    currency: string
    notes: string | null
    product: { customer_facing_product_name: string | null; supplier_product_name: string | null }
  }[]
}

interface Props {
  oppId: string
  customer: CustomerInfo
  proposals: Proposal[]
  settings: CrmSetting[]
  canEdit: boolean
  onStageChanged?: (oppId: string, newStage: OpportunityStage) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const US_VALUES = new Set(['United States', 'US', 'USA', 'us', 'usa'])

function defaultCurrency(country: string | null): string {
  if (!country) return 'USD'
  const c = country.trim()
  if (US_VALUES.has(c)) return 'USD'
  if (c === 'United Kingdom' || c === 'UK' || c === 'GB') return 'GBP'
  const euCountries = ['Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Austria', 'Ireland', 'Portugal', 'Greece', 'Finland']
  if (euCountries.includes(c)) return 'EUR'
  return 'USD'
}

// ---------------------------------------------------------------------------
// PaymentSection
// ---------------------------------------------------------------------------

export default function PaymentSection({ oppId, customer, proposals, settings, canEdit, onStageChanged }: Props) {
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/invoices?opportunity_id=${oppId}`)
      .then((r) => r.json())
      .then((data) => {
        setInvoices(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [oppId])

  const handleInvoiceCreated = useCallback((inv: InvoiceWithDetails) => {
    setInvoices((prev) => [inv, ...prev])
  }, [])

  const handleInvoiceUpdated = useCallback((inv: InvoiceWithDetails) => {
    setInvoices((prev) => prev.map((i) => i.invoice_id === inv.invoice_id ? inv : i))
  }, [])

  if (loading) return <div className="text-xs text-slate-400 py-2">Loading payment info...</div>

  // Show all invoices if they exist
  if (invoices.length > 0) {
    return (
      <div className="space-y-2">
        {invoices.map((inv) => (
          <InvoiceCard
            key={inv.invoice_id}
            invoice={inv}
            customer={customer}
            settings={settings}
            canEdit={canEdit}
            onUpdated={handleInvoiceUpdated}
            onStageChanged={onStageChanged}
            oppId={oppId}
          />
        ))}
      </div>
    )
  }

  if (!canEdit) return null

  // Build default line items from latest proposal
  const latest = proposals[0]
  const volumeKg = customer.qualified_volume_kg ?? 5
  const defaultLineItems: InvoiceLineItem[] = latest
    ? latest.items.map((item) => ({
        product_name: item.product?.customer_facing_product_name ?? 'Product',
        qty_kg: volumeKg,
        price_per_kg: item.price_per_kg,
        subtotal: item.price_per_kg * volumeKg,
      }))
    : []

  const currency = latest?.default_currency || defaultCurrency(customer.country)

  return (
    <InvoiceCreator
      customer={customer}
      settings={settings}
      defaultLineItems={defaultLineItems}
      defaultCurrency={currency}
      onCreated={handleInvoiceCreated}
      opportunityId={oppId}
    />
  )
}
