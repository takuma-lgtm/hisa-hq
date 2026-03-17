import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const { data: tasks, error } = await service
    .from('shipment_tasks')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch items for all tasks
  const taskIds = (tasks ?? []).map((t) => t.task_id)
  const { data: items } = taskIds.length > 0
    ? await service
        .from('shipment_task_items')
        .select('*, sku:skus(sku_id, sku_name, sku_type)')
        .in('task_id', taskIds)
    : { data: [] }

  // Fetch inventory levels for relevant SKUs
  const skuIds = [...new Set((items ?? []).map((i) => i.sku_id))]
  const { data: levels } = skuIds.length > 0
    ? await service
        .from('inventory_levels')
        .select('sku_id, warehouse_id, quantity, warehouse:warehouse_locations(short_code)')
        .in('sku_id', skuIds)
    : { data: [] }

  // Build stock map: { sku_id: { JP: qty, US: qty } }
  const stockMap: Record<string, Record<string, number>> = {}
  for (const level of levels ?? []) {
    const code = (level.warehouse as unknown as { short_code: string })?.short_code ?? 'JP'
    if (!stockMap[level.sku_id]) stockMap[level.sku_id] = {}
    stockMap[level.sku_id][code] = level.quantity
  }

  // Attach items + stock to tasks
  const result = (tasks ?? []).map((task) => ({
    ...task,
    items: (items ?? [])
      .filter((i) => i.task_id === task.task_id)
      .map((i) => ({
        ...i,
        stock: stockMap[i.sku_id] ?? {},
      })),
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { task_type, route, customer_name, assigned_to, items } = body

  if (!task_type || !route || !items?.length) {
    return NextResponse.json({ error: 'task_type, route, and items are required' }, { status: 400 })
  }

  const service = createServiceClient()

  // Create task
  const { data: task, error: taskError } = await service
    .from('shipment_tasks')
    .insert({
      task_type,
      route,
      customer_name: customer_name || null,
      assigned_to: assigned_to || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 })

  // Create items
  const taskItems = items.map((item: { sku_id: string; qty: number }) => ({
    task_id: task.task_id,
    sku_id: item.sku_id,
    qty: item.qty,
  }))

  const { error: itemsError } = await service
    .from('shipment_task_items')
    .insert(taskItems)

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })

  return NextResponse.json(task, { status: 201 })
}
