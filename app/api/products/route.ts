import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth'
import type { Database } from '@/types/database'

type ProductInsert = Database['public']['Tables']['products']['Insert']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!isAdmin(profile?.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await request.json()
  if (!body.product_id || !body.customer_facing_product_name) {
    return NextResponse.json(
      { error: 'product_id and customer_facing_product_name are required' },
      { status: 400 },
    )
  }

  const service = createServiceClient()

  // Whitelist allowed fields to prevent arbitrary data insertion
  const ALLOWED_FIELDS = new Set([
    'product_id', 'supplier', 'supplier_product_name', 'customer_facing_product_name',
    'product_type', 'price_per_kg', 'landing_cost_per_kg_usd',
    'min_selling_price_usd', 'default_selling_price_usd', 'gross_profit_margin',
    'harvest', 'tasting_notes', 'inventory_available', 'monthly_available_stock_kg',
    'product_guide_url', 'active', 'name_internal_jpn', 'matcha_cost_per_kg_jpy',
    'us_landing_cost_per_kg_usd', 'uk_landing_cost_per_kg_gbp', 'eu_landing_cost_per_kg_eur',
    'selling_price_usd', 'min_price_usd', 'selling_price_gbp', 'min_price_gbp',
    'selling_price_eur', 'min_price_eur', 'gross_profit_per_kg_usd',
    'tasting_headline', 'short_description', 'long_description',
    'harvest_season', 'cultivar', 'production_region', 'grind_method',
    'roast_level', 'texture_description', 'best_for', 'photo_url', 'photo_folder_url',
    'is_competitor', 'competitor_producer', 'competitor_url', 'introduced_by',
    'should_contact_producer', 'primary_supplier_id',
  ])

  const insertData: Record<string, unknown> = {
    supplier_product_name: body.supplier_product_name || body.product_id,
    price_per_kg: body.price_per_kg ?? body.selling_price_usd ?? 0,
  }
  for (const key of Object.keys(body)) {
    if (ALLOWED_FIELDS.has(key)) insertData[key] = body[key]
  }

  const { data, error } = await service
    .from('products')
    .insert(insertData as ProductInsert)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data, { status: 201 })
}
