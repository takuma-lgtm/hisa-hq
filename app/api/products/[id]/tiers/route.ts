import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('pricing_tiers')
    .select('*')
    .eq('product_id', id)
    .order('min_volume_kg', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const tiers: Array<{
    tier_name: string
    currency?: string
    min_volume_kg: number
    discount_pct: number
    price_per_kg: number
  }> = await request.json()

  const service = createServiceClient()

  // Delete existing tiers
  const { error: deleteError } = await service
    .from('pricing_tiers')
    .delete()
    .eq('product_id', id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  // Insert new tiers (if any)
  if (tiers.length > 0) {
    const rows = tiers.map((t) => ({
      product_id: id,
      tier_name: t.tier_name,
      currency: t.currency || 'USD',
      min_volume_kg: t.min_volume_kg,
      discount_pct: t.discount_pct,
      price_per_kg: t.price_per_kg,
    }))

    const { error: insertError } = await service
      .from('pricing_tiers')
      .insert(rows)

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  // Return updated tiers
  const { data } = await service
    .from('pricing_tiers')
    .select('*')
    .eq('product_id', id)
    .order('min_volume_kg', { ascending: true })

  return NextResponse.json(data)
}
