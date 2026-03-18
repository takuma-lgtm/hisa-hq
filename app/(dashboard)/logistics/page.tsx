import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import LogisticsClient from './LogisticsClient'

export default async function LogisticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient()

  const [
    { data: profile },
    { data: inTransit },
    { data: recentTransfers },
    { data: skus },
    { data: warehouses },
  ] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    service
      .from('inventory_levels')
      .select(`
        inventory_level_id,
        sku_id,
        warehouse_id,
        quantity,
        in_transit_qty,
        updated_at,
        sku:skus(sku_name, sku_type, name_external_eng),
        warehouse:warehouse_locations(name, short_code)
      `)
      .gt('in_transit_qty', 0),
    service
      .from('inventory_transactions')
      .select(`
        transaction_id,
        transaction_ref,
        sku_id,
        qty_change,
        movement_type,
        carrier,
        delivery_status,
        date_shipped,
        date_received,
        created_at,
        sku:skus(sku_name, name_external_eng),
        warehouse:warehouse_locations(name, short_code)
      `)
      .in('movement_type', ['transfer_jp_us_out', 'transfer_jp_us_in'])
      .order('created_at', { ascending: false })
      .limit(50),
    service
      .from('skus')
      .select('sku_id, sku_name, sku_type, name_external_eng, product_id')
      .eq('is_active', true)
      .order('sku_name'),
    service
      .from('warehouse_locations')
      .select('warehouse_id, name, short_code')
      .eq('is_active', true),
  ])

  const role = profile?.role ?? 'member'
  const canWrite = role === 'owner' || role === 'admin'

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <LogisticsClient
        inTransit={inTransit ?? []}
        recentTransfers={recentTransfers ?? []}
        skus={skus ?? []}
        warehouses={warehouses ?? []}
        canWrite={canWrite}
      />
    </div>
  )
}
