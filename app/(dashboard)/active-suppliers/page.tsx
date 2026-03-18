import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import ActiveSuppliersGrid from './ActiveSuppliersGrid'

export default async function ActiveSuppliersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient()

  const [{ data: profile }, { data: suppliers }, { data: orders }, { data: linkedProducts }, { data: comms }] = await Promise.all([
    service.from('profiles').select('role').eq('id', user.id).single(),
    service.from('suppliers').select('*').eq('stage', 'deal_established').order('supplier_name'),
    service.from('supplier_purchase_orders').select('*, items:supplier_purchase_order_items(*)').order('order_date', { ascending: false }),
    service.from('supplier_products').select('*, product:products(product_id, customer_facing_product_name)'),
    service.from('supplier_communications').select('supplier_id, created_at').order('created_at', { ascending: false }),
  ])

  const role = profile?.role ?? 'member'
  if (role === 'member') redirect('/')

  // Filter orders and products to only active suppliers
  const supplierIds = new Set((suppliers ?? []).map((s) => s.supplier_id))

  const supplierOrders = (orders ?? []).filter((o) => supplierIds.has(o.supplier_id))
  const supplierProducts = (linkedProducts ?? []).filter((lp) => supplierIds.has(lp.supplier_id))

  // Last contact per supplier
  const lastContact: Record<string, string> = {}
  for (const c of comms ?? []) {
    if (supplierIds.has(c.supplier_id) && !lastContact[c.supplier_id]) {
      lastContact[c.supplier_id] = c.created_at
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-6 py-4 border-b border-slate-200">
        <h1 className="text-2xl font-serif text-slate-900">Active Suppliers</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {(suppliers ?? []).length} active supplier{(suppliers ?? []).length !== 1 ? 's' : ''}
        </p>
      </div>

      {(suppliers ?? []).length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-12">
          <p className="text-sm text-slate-400">No active suppliers yet. Convert suppliers from the pipeline when deals are established.</p>
        </div>
      ) : (
        <ActiveSuppliersGrid
          suppliers={suppliers ?? []}
          orders={supplierOrders}
          linkedProducts={supplierProducts}
          lastContact={lastContact}
        />
      )}
    </div>
  )
}
