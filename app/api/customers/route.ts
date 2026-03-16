import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const VALID_STATUSES = ['lead', 'qualified_opportunity', 'recurring_customer', 'lost'] as const
type CustomerStatus = (typeof VALID_STATUSES)[number]

export async function GET(request: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const statusParam = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500)

  const sb = createServiceClient()
  let query = sb
    .from('customers')
    .select('customer_id, cafe_name, address, city, state, country')
    .order('cafe_name')
    .limit(limit)

  if (statusParam) {
    // Map "customer" shorthand to actual enum value
    const statusMap: Record<string, CustomerStatus> = {
      customer: 'recurring_customer',
      lead: 'lead',
      qualified_opportunity: 'qualified_opportunity',
      recurring_customer: 'recurring_customer',
      lost: 'lost',
    }
    const mapped = statusMap[statusParam]
    if (mapped) {
      query = query.eq('status', mapped)
    }
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}
