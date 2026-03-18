import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const CONVERTIBLE_STAGES = ['in_communication', 'visit_scheduled', 'visited', 'inquiry_sent', 'met_at_event']

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const service = createServiceClient()

  // Fetch current supplier
  const { data: supplier, error: fetchError } = await service
    .from('suppliers')
    .select('supplier_id, stage')
    .eq('supplier_id', id)
    .single()

  if (fetchError || !supplier) {
    return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
  }

  if (supplier.stage === 'deal_established') {
    return NextResponse.json({ error: 'Already an active supplier' }, { status: 400 })
  }

  if (supplier.stage === 'ng' || supplier.stage === 'not_started') {
    return NextResponse.json({ error: 'Cannot convert supplier at this stage' }, { status: 400 })
  }

  // Update to deal_established
  const { data: updated, error: updateError } = await service
    .from('suppliers')
    .update({
      stage: 'deal_established',
      converted_at: new Date().toISOString(),
    })
    .eq('supplier_id', id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })
  return NextResponse.json(updated)
}
