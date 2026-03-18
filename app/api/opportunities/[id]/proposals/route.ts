import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendQuoteEmail } from '@/lib/email'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: opportunityId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('opportunity_proposals')
    .select(`
      *,
      items:opportunity_proposal_items(
        *,
        product:products(customer_facing_product_name, supplier_product_name)
      )
    `)
    .eq('opportunity_id', opportunityId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ proposals: data })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: opportunityId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { sent_via, notes, default_currency, items, send_email } = body

  if (!items?.length) {
    return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
  }

  // Insert proposal header
  const { data: proposal, error: propError } = await supabase
    .from('opportunity_proposals')
    .insert({
      opportunity_id: opportunityId,
      sent_via: sent_via ?? 'ig',
      notes: notes ?? null,
      default_currency: default_currency ?? 'USD',
      created_by: user.id,
    })
    .select()
    .single()

  if (propError || !proposal) {
    return NextResponse.json({ error: propError?.message ?? 'Failed to create proposal' }, { status: 500 })
  }

  // Insert items
  const { error: itemsError } = await supabase
    .from('opportunity_proposal_items')
    .insert(
      items.map((item: { product_id: string; price_per_kg: number; currency?: string; notes?: string }) => ({
        proposal_id: proposal.proposal_id,
        product_id: item.product_id,
        price_per_kg: item.price_per_kg,
        currency: item.currency ?? 'USD',
        notes: item.notes ?? null,
      })),
    )

  if (itemsError) {
    // Clean up proposal header if items failed
    await supabase.from('opportunity_proposals').delete().eq('proposal_id', proposal.proposal_id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // Fetch full proposal with items + product names
  const { data: full, error: fetchError } = await supabase
    .from('opportunity_proposals')
    .select(`
      *,
      items:opportunity_proposal_items(
        *,
        product:products(customer_facing_product_name, supplier_product_name)
      )
    `)
    .eq('proposal_id', proposal.proposal_id)
    .single()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  // If send_email is requested, send quote email from sales@ and advance stage
  if (send_email && full) {
    const service = createServiceClient()

    // Fetch customer contact info
    const { data: opp } = await service
      .from('opportunities')
      .select('customer:customers(cafe_name, email, contact_person)')
      .eq('opportunity_id', opportunityId)
      .single()

    type CustomerInfo = { cafe_name: string; email: string | null; contact_person: string | null }
    const customer = (opp?.customer as CustomerInfo | null) ?? null

    if (customer?.email) {
      try {
        type ItemWithProduct = {
          price_per_kg: number
          currency: string
          notes: string | null
          product: { customer_facing_product_name: string } | null
        }
        const proposalItems = (full.items as unknown as ItemWithProduct[]).map((item) => ({
          productName: item.product?.customer_facing_product_name ?? 'Unknown Product',
          pricePerKg: item.price_per_kg,
          currency: item.currency,
          notes: item.notes,
        }))

        await sendQuoteEmail({
          to: customer.email,
          cafeName: customer.cafe_name,
          contactPerson: customer.contact_person,
          proposalItems,
          notes: notes ?? null,
        })
      } catch (emailErr) {
        // Log but don't fail the response — proposal is already saved
        console.error('Quote email failed:', emailErr)
      }
    }

    // Advance opportunity stage to quote_sent
    await service
      .from('opportunities')
      .update({ stage: 'quote_sent' as never, updated_at: new Date().toISOString() })
      .eq('opportunity_id', opportunityId)
  }

  return NextResponse.json({ proposal: full }, { status: 201 })
}
