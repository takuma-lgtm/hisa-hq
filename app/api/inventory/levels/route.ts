import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const warehouse = searchParams.get('warehouse')
  const skuType = searchParams.get('sku_type')
  const lowStock = searchParams.get('low_stock')

  const service = createServiceClient()
  let query = service
    .from('inventory_levels')
    .select(`
      *,
      sku:skus(sku_name, sku_type, unit_cost_jpy, product_id, name_external_eng, unit_weight_kg),
      warehouse:warehouse_locations(name, short_code)
    `)

  if (warehouse) {
    // Filter by warehouse short_code via join
    query = query.eq('warehouse.short_code', warehouse)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let filtered = data ?? []

  // Post-query filters on joined fields
  if (skuType) {
    filtered = filtered.filter((row: Record<string, unknown>) => {
      const sku = row.sku as Record<string, unknown> | null
      return sku?.sku_type === skuType
    })
  }

  if (lowStock === 'true') {
    filtered = filtered.filter((row: Record<string, unknown>) => (row.quantity as number) < 5)
  }

  return NextResponse.json(filtered)
}
