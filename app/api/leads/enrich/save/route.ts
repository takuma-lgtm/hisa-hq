import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function PATCH(request: Request) {
  // Auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'lead_gen') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  let body: {
    customerId: string
    email?: string | null
    phone?: string | null
    instagram_url?: string | null
    contact_person?: string | null
    contact_title?: string | null
    linkedin_url?: string | null
    company_size?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.customerId) {
    return NextResponse.json(
      { error: 'customerId is required' },
      { status: 400 },
    )
  }

  try {
    const service = createServiceClient()

    // Build update with only provided fields
    const update: Record<string, unknown> = {
      last_enriched_at: new Date().toISOString(),
    }

    if (body.email !== undefined && body.email !== null) {
      update.email = body.email.trim()
    }
    if (body.phone !== undefined && body.phone !== null) {
      update.phone = body.phone.trim()
    }
    if (body.instagram_url !== undefined && body.instagram_url !== null) {
      update.instagram_url = body.instagram_url.trim()
    }
    if (body.contact_person !== undefined && body.contact_person !== null) {
      update.contact_person = body.contact_person.trim()
    }
    if (body.contact_title !== undefined && body.contact_title !== null) {
      update.contact_title = body.contact_title.trim()
    }
    if (body.linkedin_url !== undefined && body.linkedin_url !== null) {
      update.linkedin_url = body.linkedin_url.trim()
    }
    if (body.company_size !== undefined && body.company_size !== null) {
      update.company_size = body.company_size.trim()
    }

    const { data, error } = await service
      .from('customers')
      .update(update as never)
      .eq('customer_id', body.customerId)
      .select('customer_id, email, phone, instagram_url, contact_person, contact_title, linkedin_url, company_size, last_enriched_at')
      .single()

    if (error) {
      return NextResponse.json(
        { error: `Update failed: ${error.message}` },
        { status: 500 },
      )
    }

    return NextResponse.json({ updated: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
