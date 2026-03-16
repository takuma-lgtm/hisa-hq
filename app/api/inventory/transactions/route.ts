import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
  const movementType = searchParams.get('movement_type')
  const skuId = searchParams.get('sku_id')
  const fromDate = searchParams.get('from_date')
  const toDate = searchParams.get('to_date')
  const carrier = searchParams.get('carrier')

  const service = createServiceClient()
  let query = service
    .from('inventory_transactions')
    .select(`
      *,
      sku:skus(sku_name, name_external_eng),
      warehouse:warehouse_locations(name, short_code)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (movementType) query = query.eq('movement_type', movementType)
  if (skuId) query = query.eq('sku_id', skuId)
  if (carrier) query = query.eq('carrier', carrier)
  if (fromDate) query = query.gte('created_at', `${fromDate}T00:00:00`)
  if (toDate) query = query.lte('created_at', `${toDate}T23:59:59`)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    limit,
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'closer'].includes(profile.role)) {
    return NextResponse.json({ error: 'Admin or closer access required' }, { status: 403 })
  }

  const body = await request.json()
  if (!body.sku_id || !body.movement_type || body.qty_change === undefined) {
    return NextResponse.json(
      { error: 'sku_id, movement_type, and qty_change are required' },
      { status: 400 },
    )
  }

  const service = createServiceClient()

  // Auto-generate transaction ref for inbound
  if (body.movement_type === 'inbound_supplier_jp' && !body.transaction_ref) {
    const year = new Date().getFullYear()
    const { data: seqData } = await service.rpc('nextval_text', { seq_name: 'inbound_po_seq' })
    const seq = String(seqData ?? '1').padStart(3, '0')
    body.transaction_ref = `PO-${year}-${seq}`
  }

  // Insert the transaction
  const { data: txn, error: txnErr } = await service
    .from('inventory_transactions')
    .insert({
      ...body,
      created_by: user.id,
    })
    .select(`
      *,
      sku:skus(sku_name, name_external_eng),
      warehouse:warehouse_locations(name, short_code)
    `)
    .single()

  if (txnErr) return NextResponse.json({ error: txnErr.message }, { status: 400 })

  // Update inventory level if warehouse_affected is set
  if (body.warehouse_affected) {
    // Try to find existing level
    const { data: existing } = await service
      .from('inventory_levels')
      .select('inventory_level_id, quantity')
      .eq('sku_id', body.sku_id)
      .eq('warehouse_id', body.warehouse_affected)
      .single()

    if (existing) {
      await service
        .from('inventory_levels')
        .update({
          quantity: existing.quantity + body.qty_change,
          updated_at: new Date().toISOString(),
        })
        .eq('inventory_level_id', existing.inventory_level_id)
    } else {
      await service
        .from('inventory_levels')
        .insert({
          sku_id: body.sku_id,
          warehouse_id: body.warehouse_affected,
          quantity: Math.max(0, body.qty_change),
          in_transit_qty: 0,
        })
    }
  }

  return NextResponse.json(txn, { status: 201 })
}
