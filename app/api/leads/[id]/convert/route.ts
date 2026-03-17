import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, name').eq('id', user.id).single()

  if (!profile) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const service = createServiceClient()

  // Verify the customer is a qualified lead
  const { data: customer, error: custError } = await service
    .from('customers')
    .select('customer_id, status, lead_stage, lead_assigned_to, cafe_name, qualified_products, qualified_volume_kg, qualified_budget')
    .eq('customer_id', id)
    .single()

  if (custError || !customer) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  if (customer.status !== 'lead') {
    return NextResponse.json({ error: 'Customer is not a lead' }, { status: 400 })
  }

  if (!['replied', 'qualified'].includes(customer.lead_stage)) {
    return NextResponse.json(
      { error: 'Lead must be in "replied" or "qualified" stage before conversion' },
      { status: 400 },
    )
  }

  // Check no existing opportunity
  const { data: existing } = await service
    .from('opportunities')
    .select('opportunity_id')
    .eq('customer_id', id)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'An opportunity already exists for this lead', opportunity_id: existing[0].opportunity_id },
      { status: 409 },
    )
  }

  // Update customer status + copy qualification data to standard fields
  const { error: updateError } = await service
    .from('customers')
    .update({
      status: 'qualified_opportunity',
      lead_stage: 'handed_off',
      monthly_matcha_usage_kg: customer.qualified_volume_kg,
      budget_range: customer.qualified_budget,
    })
    .eq('customer_id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Build qualification summary for opportunity notes
  const qualifierName = profile?.name || 'Unknown'
  const notes = `Qualified by ${qualifierName}. Products: ${customer.qualified_products}. Volume: ${customer.qualified_volume_kg}kg/mo. Budget: ${customer.qualified_budget}.`

  // Create opportunity
  const { data: opportunity, error: oppError } = await service
    .from('opportunities')
    .insert({
      customer_id: id,
      stage: 'lead_created',
      assigned_to: customer.lead_assigned_to,
      notes,
    })
    .select('opportunity_id')
    .single()

  if (oppError) {
    return NextResponse.json({ error: oppError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    opportunity_id: opportunity.opportunity_id,
  })
}
