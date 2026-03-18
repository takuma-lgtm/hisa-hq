import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'
import InventoryClient from './InventoryClient'

export default async function InventoryPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient()

  const [
    { data: profile },
    { data: levels },
    { data: skus },
    { data: warehouses },
    { data: exchangeRateSetting },
  ] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    service
      .from('inventory_levels')
      .select(`
        *,
        sku:skus(sku_name, sku_type, unit_cost_jpy, product_id, name_external_eng, unit_weight_kg, low_stock_threshold),
        warehouse:warehouse_locations(name, short_code)
      `),
    service
      .from('skus')
      .select('sku_id, sku_name, product_id, name_external_eng, sku_type, is_active, product:products(supplier)')
      .eq('is_active', true)
      .order('sku_name'),
    service
      .from('warehouse_locations')
      .select('warehouse_id, name, short_code')
      .eq('is_active', true),
    service
      .from('crm_settings')
      .select('value')
      .eq('key', 'exchange_rate_usd_jpy')
      .single(),
  ])

  const role = (profile?.role ?? 'member') as UserRole
  const isAdmin = role === 'owner' || role === 'admin'
  const canWrite = role === 'owner' || role === 'admin'
  const exchangeRate = parseFloat(exchangeRateSetting?.value ?? '150')

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <InventoryClient
        levels={levels ?? []}
        skus={skus ?? []}
        warehouses={warehouses ?? []}
        exchangeRate={exchangeRate}
        isAdmin={isAdmin}
        canWrite={canWrite}
      />
    </div>
  )
}
