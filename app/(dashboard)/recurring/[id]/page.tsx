import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { InvoiceWithDetails } from '@/types/database'
import RecurringDetail from './RecurringDetail'

export default async function RecurringCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: customerId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  const canEdit = profile?.role === 'owner' || profile?.role === 'admin'
  const service = createServiceClient()

  // Fetch customer, orders, invoices, settings, and products in parallel
  const [customerRes, ordersRes, invoicesRes, settingsRes, productsRes] = await Promise.all([
    service.from('customers').select('*').eq('customer_id', customerId).single(),
    service.from('recurring_orders')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
    service.from('invoices')
      .select('*')
      .eq('customer_id', customerId)
      .is('opportunity_id', null)
      .order('created_at', { ascending: false }),
    service.from('crm_settings').select('*'),
    service.from('products')
      .select('product_id, customer_facing_product_name, selling_price_usd, selling_price_gbp, selling_price_eur')
      .eq('status', 'active'),
  ])

  if (!customerRes.data) {
    redirect('/recurring')
  }

  const customer = customerRes.data

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <RecurringDetail
        customer={customer}
        orders={ordersRes.data ?? []}
        invoices={(invoicesRes.data ?? []) as unknown as InvoiceWithDetails[]}
        settings={settingsRes.data ?? []}
        products={productsRes.data ?? []}
        canEdit={canEdit}
      />
    </div>
  )
}
