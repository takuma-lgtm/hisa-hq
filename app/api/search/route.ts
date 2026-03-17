import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export interface SearchResult {
  id: string
  label: string
  subtitle: string
  type: 'lead' | 'opportunity' | 'product' | 'supplier' | 'sku' | 'invoice'
  href: string
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const service = createServiceClient()
  const pattern = `%${q}%`

  const [
    { data: customers },
    { data: opportunities },
    { data: products },
    { data: suppliers },
    { data: skus },
    { data: invoices },
  ] = await Promise.all([
    // Leads / Customers
    service
      .from('customers')
      .select('customer_id, cafe_name, city, status, lead_stage')
      .or(`cafe_name.ilike.${pattern},contact_person.ilike.${pattern},email.ilike.${pattern},city.ilike.${pattern}`)
      .limit(5),
    // Opportunities (via customer name)
    service
      .from('opportunities')
      .select('opportunity_id, stage, customers(cafe_name, city)')
      .limit(5),
    // Products
    service
      .from('products')
      .select('product_id, customer_facing_product_name, product_type')
      .or(`customer_facing_product_name.ilike.${pattern},product_id.ilike.${pattern}`)
      .limit(5),
    // Suppliers
    service
      .from('suppliers')
      .select('supplier_id, supplier_name, supplier_name_en, city')
      .or(`supplier_name.ilike.${pattern},supplier_name_en.ilike.${pattern},contact_person.ilike.${pattern}`)
      .limit(5),
    // SKUs
    service
      .from('skus')
      .select('sku_id, sku_name, name_external_eng, sku_type')
      .or(`sku_name.ilike.${pattern},name_external_eng.ilike.${pattern}`)
      .limit(5),
    // Invoices
    service
      .from('invoices')
      .select('invoice_id, invoice_number, amount, currency, customer_id')
      .ilike('invoice_number', pattern)
      .limit(5),
  ])

  const results: SearchResult[] = []

  for (const c of customers ?? []) {
    const isLead = c.status === 'lead'
    results.push({
      id: c.customer_id,
      label: c.cafe_name,
      subtitle: [c.city, isLead ? c.lead_stage : c.status].filter(Boolean).join(' · '),
      type: 'lead',
      href: isLead ? `/leads/${c.customer_id}` : `/recurring`,
    })
  }

  // Filter opportunities client-side since we can't ilike on joined field
  for (const o of opportunities ?? []) {
    const cust = o.customers as Record<string, unknown> | null
    const cafeName = (cust?.cafe_name as string) ?? ''
    const city = (cust?.city as string) ?? ''
    if (!cafeName.toLowerCase().includes(q.toLowerCase())) continue
    results.push({
      id: o.opportunity_id,
      label: cafeName,
      subtitle: [o.stage, city].filter(Boolean).join(' · '),
      type: 'opportunity',
      href: `/opportunities?selected=${o.opportunity_id}`,
    })
  }

  for (const p of products ?? []) {
    results.push({
      id: p.product_id,
      label: p.customer_facing_product_name ?? p.product_id,
      subtitle: [p.product_id, p.product_type].filter(Boolean).join(' · '),
      type: 'product',
      href: '/products',
    })
  }

  for (const s of suppliers ?? []) {
    results.push({
      id: s.supplier_id,
      label: s.supplier_name ?? s.supplier_name_en ?? 'Supplier',
      subtitle: [s.supplier_name_en, s.city].filter(Boolean).join(' · '),
      type: 'supplier',
      href: `/suppliers/${s.supplier_id}`,
    })
  }

  for (const sk of skus ?? []) {
    results.push({
      id: sk.sku_id,
      label: sk.sku_name,
      subtitle: [sk.name_external_eng, sk.sku_type].filter(Boolean).join(' · '),
      type: 'sku',
      href: '/inventory',
    })
  }

  for (const inv of invoices ?? []) {
    results.push({
      id: inv.invoice_id,
      label: inv.invoice_number ?? `Invoice`,
      subtitle: inv.amount ? `${inv.currency} ${inv.amount}` : '',
      type: 'invoice',
      href: '/recurring',
    })
  }

  return NextResponse.json({ results })
}
