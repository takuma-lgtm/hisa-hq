import { notFound, redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import ActiveSupplierDetailClient from './ActiveSupplierDetailClient'

export default async function ActiveSupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient()

  const [{ data: profile }, { data: supplier }, { data: orders }, { data: comms }, { data: linkedProducts }, { data: templates }, { data: allProducts }] = await Promise.all([
    service.from('profiles').select('role').eq('id', user.id).single(),
    service.from('suppliers').select('*').eq('supplier_id', id).single(),
    service.from('supplier_purchase_orders').select('*, items:supplier_purchase_order_items(*)').eq('supplier_id', id).order('order_date', { ascending: false }),
    service.from('supplier_communications').select('*').eq('supplier_id', id).order('created_at', { ascending: false }),
    service.from('supplier_products').select('*, product:products(product_id, customer_facing_product_name, product_type)').eq('supplier_id', id),
    service.from('supplier_message_templates').select('*').order('is_default', { ascending: false }),
    service.from('products').select('product_id, customer_facing_product_name').eq('active', true).order('customer_facing_product_name'),
  ])

  if (!supplier || supplier.stage !== 'deal_established') notFound()

  const role = profile?.role ?? 'member'
  const canEdit = role === 'owner' || role === 'admin'

  return (
    <ActiveSupplierDetailClient
      supplier={supplier}
      orders={orders ?? []}
      communications={comms ?? []}
      linkedProducts={linkedProducts ?? []}
      templates={templates ?? []}
      allProducts={allProducts ?? []}
      canEdit={canEdit}
    />
  )
}
