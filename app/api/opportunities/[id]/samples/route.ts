import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: opportunityId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('sample_batches')
    .select('*, items:sample_batch_items(*)')
    .eq('opportunity_id', opportunityId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ batches: data })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: opportunityId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only closer and admin can create sample batches
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['closer', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { customer_id, carrier, tracking_number, ship_from, shipped_at, items } = body

  if (!customer_id) {
    return NextResponse.json({ error: 'customer_id is required' }, { status: 400 })
  }

  // Insert sample batch
  const { data: batch, error: batchError } = await supabase
    .from('sample_batches')
    .insert({
      opportunity_id: opportunityId,
      customer_id,
      carrier: carrier ?? null,
      tracking_number: tracking_number ?? null,
      ship_from: ship_from ?? 'US Warehouse',
      shipped_at: shipped_at ?? null,
      date_shipped: shipped_at ? shipped_at.split('T')[0] : null,
      delivery_status: 'in_transit',
    })
    .select()
    .single()

  if (batchError || !batch) {
    return NextResponse.json({ error: batchError?.message ?? 'Failed to create batch' }, { status: 500 })
  }

  // Insert items
  if (items?.length) {
    const { error: itemsError } = await supabase
      .from('sample_batch_items')
      .insert(
        items.map((item: {
          product_id?: string
          product_snapshot?: string
          qty_grams?: number
          notes?: string
        }) => ({
          batch_id: batch.batch_id,
          product_id: item.product_id ?? null,
          product_snapshot: item.product_snapshot ?? null,
          qty_grams: item.qty_grams ?? null,
          notes: item.notes ?? null,
          feedback: 'pending',
        })),
      )

    if (itemsError) {
      await supabase.from('sample_batches').delete().eq('batch_id', batch.batch_id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }
  }

  // Advance opportunity stage to samples_shipped
  await supabase
    .from('opportunities')
    .update({ stage: 'samples_shipped' })
    .eq('opportunity_id', opportunityId)

  // Fetch full batch with items
  const { data: full, error: fetchError } = await supabase
    .from('sample_batches')
    .select('*, items:sample_batch_items(*)')
    .eq('batch_id', batch.batch_id)
    .single()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  return NextResponse.json({ batch: full }, { status: 201 })
}
