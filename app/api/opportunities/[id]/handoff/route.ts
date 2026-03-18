import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { validateHandoff } from '@/lib/handoff'
import type { Customer } from '@/types/database'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: opportunityId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only member and admin can trigger a handoff
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['owner', 'admin', 'member'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const assignedTo: string | undefined = body.assigned_to

  if (!assignedTo) {
    return NextResponse.json({ error: 'assigned_to (closer user ID) is required' }, { status: 400 })
  }

  // Verify the assigned closer exists and has the right role
  const { data: closerProfile } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', assignedTo)
    .single()

  if (!closerProfile || !['owner', 'admin'].includes(closerProfile.role)) {
    return NextResponse.json({ error: 'assigned_to must be an owner or admin user' }, { status: 400 })
  }

  // Fetch opportunity + customer
  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('*, customer:customers(*)')
    .eq('opportunity_id', opportunityId)
    .single()

  if (!opportunity) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  const customer = opportunity.customer as Customer

  // Run handoff validation
  const errors = validateHandoff(customer)
  if (errors.length > 0) {
    return NextResponse.json(
      { error: 'Handoff validation failed', validationErrors: errors },
      { status: 422 },
    )
  }

  // Execute handoff using service client to bypass RLS for cross-table updates
  const service = createServiceClient()
  const now = new Date().toISOString()

  const { error: oppError } = await service
    .from('opportunities')
    .update({
      stage: 'sample_approved',
      assigned_to: assignedTo,
      handoff_at: now,
      handoff_to: assignedTo,
    })
    .eq('opportunity_id', opportunityId)

  if (oppError) {
    return NextResponse.json({ error: 'Failed to update opportunity' }, { status: 500 })
  }

  const { error: custError } = await service
    .from('customers')
    .update({ status: 'qualified_opportunity' })
    .eq('customer_id', customer.customer_id)

  if (custError) {
    console.error('Failed to update customer status:', custError)
    // Non-fatal; opportunity stage already updated
  }

  // Notify the closer
  await service.rpc('create_notification', {
    p_user_id: assignedTo,
    p_type: 'handoff_received' as never,  // enum extended in DB
    p_message: `New handoff: ${customer.cafe_name} is ready for sample shipment`,
    p_reference_id: opportunityId,
    p_reference_type: 'opportunity',
  })

  return NextResponse.json({
    success: true,
    assigned_to: closerProfile.name,
    stage: 'sample_approved',
  })
}
