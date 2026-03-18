import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: opportunityId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch opportunity with customer data
  const { data: opp, error: oppErr } = await supabase
    .from('opportunities')
    .select('opportunity_id, stage, customer_id, assigned_to, customers(customer_id, qualified_volume_kg, monthly_matcha_usage_kg)')
    .eq('opportunity_id', opportunityId)
    .single()

  if (oppErr || !opp) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  if (opp.stage !== 'deal_won') {
    return NextResponse.json({ error: 'Opportunity must be in deal_won stage' }, { status: 400 })
  }

  // Fetch latest proposal (if any)
  const { data: proposals } = await supabase
    .from('opportunity_proposals')
    .select('proposal_id')
    .eq('opportunity_id', opportunityId)
    .order('created_at', { ascending: false })
    .limit(1)

  let lineItems: { product_id: string; product_name: string; price_per_kg: number; currency: string }[] = []

  if (proposals?.[0]) {
    // Fetch items for the latest proposal
    const { data: items } = await supabase
      .from('opportunity_proposal_items')
      .select('product_id, price_per_kg, currency')
      .eq('proposal_id', proposals[0].proposal_id)

    // Fetch product names for items
    if (items?.length) {
      const productIds = [...new Set(items.map((i) => i.product_id))]
      const { data: products } = await supabase
        .from('products')
        .select('product_id, customer_facing_product_name')
        .in('product_id', productIds)

      const productMap = new Map(
        (products ?? []).map((p) => [p.product_id, p.customer_facing_product_name])
      )

      lineItems = items.map((item) => ({
        product_id: item.product_id,
        product_name: productMap.get(item.product_id) ?? item.product_id,
        price_per_kg: item.price_per_kg,
        currency: item.currency,
      }))
    }
  }

  const customer = opp.customers as Record<string, unknown> | null
  const monthlyVolume = (customer?.qualified_volume_kg as number) ?? (customer?.monthly_matcha_usage_kg as number) ?? null

  // Update customer status
  const { error: custErr } = await supabase
    .from('customers')
    .update({ status: 'recurring_customer' })
    .eq('customer_id', opp.customer_id)

  if (custErr) {
    return NextResponse.json({ error: custErr.message }, { status: 500 })
  }

  // Update opportunity stage
  const { error: stageErr } = await supabase
    .from('opportunities')
    .update({ stage: 'recurring_customer', updated_at: new Date().toISOString() })
    .eq('opportunity_id', opportunityId)

  if (stageErr) {
    return NextResponse.json({ error: stageErr.message }, { status: 500 })
  }

  // Create recurring order entry
  const { error: orderErr } = await supabase
    .from('recurring_orders')
    .insert({
      customer_id: opp.customer_id,
      assigned_closer: opp.assigned_to,
      line_items: lineItems as unknown as Json,
      total_amount: null,
      monthly_volume: monthlyVolume,
      status: 'active',
      notes: 'Converted from opportunity. First order.',
    })

  if (orderErr) {
    return NextResponse.json({ error: orderErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, customer_id: opp.customer_id })
}
