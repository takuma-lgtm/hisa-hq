import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth'

const ALLOWED_FIELDS = new Set([
  'supplier', 'supplier_product_name', 'customer_facing_product_name',
  'product_type', 'price_per_kg', 'landing_cost_per_kg_usd',
  'min_selling_price_usd', 'default_selling_price_usd', 'gross_profit_margin',
  'harvest', 'tasting_notes', 'inventory_available', 'monthly_available_stock_kg',
  'product_guide_url', 'active', 'last_synced_at',
  'date_added', 'name_internal_jpn', 'matcha_cost_per_kg_jpy',
  'us_landing_cost_per_kg_usd', 'uk_landing_cost_per_kg_gbp', 'eu_landing_cost_per_kg_eur',
  'selling_price_usd', 'min_price_usd', 'selling_price_gbp', 'min_price_gbp',
  'selling_price_eur', 'min_price_eur', 'gross_profit_per_kg_usd',
  // Migration 016 additions
  'tasting_headline', 'short_description', 'long_description',
  'harvest_season', 'cultivar', 'production_region', 'grind_method',
  'roast_level', 'texture_description', 'best_for', 'photo_url', 'photo_folder_url',
  'is_competitor', 'competitor_producer', 'competitor_url', 'introduced_by',
  'should_contact_producer',
  'primary_supplier_id',
])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!isAdmin(profile?.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await request.json()
  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key)) {
      updateData[key] = value
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('products')
    .update(updateData)
    .eq('product_id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}
