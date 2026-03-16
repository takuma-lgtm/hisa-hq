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
    .from('sensory_logs')
    .select('*')
    .eq('product_id', id)
    .order('tasted_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const service = createServiceClient()
  const { data, error } = await service
    .from('sensory_logs')
    .insert({
      product_id: id,
      taster_name: body.taster_name,
      tasted_at: body.tasted_at || undefined,
      umami_rating: body.umami_rating ?? null,
      bitterness_rating: body.bitterness_rating ?? null,
      fineness_rating: body.fineness_rating ?? null,
      color_notes: body.color_notes ?? null,
      texture_notes: body.texture_notes ?? null,
      aroma_notes: body.aroma_notes ?? null,
      flavor_notes: body.flavor_notes ?? null,
      comparison_notes: body.comparison_notes ?? null,
      general_notes: body.general_notes ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
