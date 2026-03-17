import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { OPPORTUNITY_TABLE_STAGES } from '@/lib/constants'
import DashboardMetrics from './components/DashboardMetrics'
import DashboardFocusProducts from './components/DashboardFocusProducts'
import DashboardShipments from './components/DashboardShipments'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient()
  const now = new Date()

  // All queries in parallel
  const [
    { count: activeLeads },
    { count: contactedLeads },
    { count: repliedLeads },
    { count: contactedDenominator },
    { data: activeOpps },
    { data: inventoryLevels },
    { data: exchangeRateSetting },
    { data: allLevels },
    { data: supplierData },
    { data: shipmentTasks },
    { data: shipmentTaskItems },
    { data: usOrdersRaw },
    { data: usOrderItemsRaw },
    { data: focusProductCategoriesSetting },
    { data: allProducts },
    { data: allSkus },
    { data: allInventoryLevels },
    { data: teamProfiles },
  ] = await Promise.all([
    // Metric 1: Active leads
    service
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'lead')
      .neq('lead_stage', 'disqualified'),
    // Metric 2: Leads contacted
    service
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'lead')
      .in('lead_stage', ['contacted', 'replied', 'qualified']),
    // Metric 3a: Reply rate numerator
    service
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'lead')
      .in('lead_stage', ['replied', 'qualified', 'handed_off']),
    // Metric 3b: Reply rate denominator
    service
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'lead')
      .in('lead_stage', ['contacted', 'replied', 'qualified', 'handed_off']),
    // Metric 4 + Pipeline: Active opportunities with stage
    service
      .from('opportunities')
      .select('opportunity_id, stage, updated_at, customer_id, customers(cafe_name)')
      .in('stage', OPPORTUNITY_TABLE_STAGES),
    // Metric 5: Inventory levels with SKU cost (only positive stock)
    service
      .from('inventory_levels')
      .select('quantity, sku:skus(sku_id, sku_name, unit_cost_jpy)')
      .gt('quantity', 0),
    // Metric 5 cont: Exchange rate
    service
      .from('crm_settings')
      .select('value')
      .eq('key', 'exchange_rate_usd_jpy')
      .single(),
    // Low stock: all levels for aggregation
    service
      .from('inventory_levels')
      .select('quantity, sku:skus(sku_id, sku_name, name_external_eng)'),
    // Supplier pipeline
    service
      .from('suppliers')
      .select('supplier_id, stage, sample_status'),
    // Shipment tasks (open)
    service
      .from('shipment_tasks')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false }),
    // Shipment task items with SKU info
    service
      .from('shipment_task_items')
      .select('*, sku:skus(sku_id, sku_name, sku_type)'),
    // US outbound orders (pending/packed)
    service
      .from('us_outbound_orders')
      .select('order_id, order_number, customer_name, status, created_at')
      .in('status', ['pending', 'packed'])
      .order('created_at', { ascending: false }),
    // US order items
    service
      .from('us_outbound_order_items')
      .select('order_id, sku_name, quantity'),
    // Focus product categories setting
    service
      .from('crm_settings')
      .select('value')
      .eq('key', 'focus_product_categories')
      .single(),
    // All active products (for focus picker)
    service
      .from('products')
      .select('product_id, customer_facing_product_name, selling_price_usd, gross_profit_margin, active')
      .eq('active', true),
    // All active SKUs (for task creation)
    service
      .from('skus')
      .select('sku_id, sku_name, sku_type, product_id')
      .eq('is_active', true)
      .order('sku_name'),
    // All inventory levels (for stock display in tasks)
    service
      .from('inventory_levels')
      .select('sku_id, warehouse_id, quantity, in_transit_qty, warehouse:warehouse_locations(short_code)'),
    // Team profiles
    service
      .from('profiles')
      .select('id, name'),
  ])

  // Compute metrics
  const exchangeRate = parseFloat(exchangeRateSetting?.value ?? '150')
  const replyRate = (contactedDenominator ?? 0) > 0
    ? Math.round(((repliedLeads ?? 0) / (contactedDenominator ?? 1)) * 100)
    : 0

  // Inventory value in USD
  let inventoryValueUsd = 0
  for (const level of inventoryLevels ?? []) {
    const sku = level.sku as Record<string, unknown> | null
    const costJpy = (sku?.unit_cost_jpy as number) ?? 0
    inventoryValueUsd += level.quantity * costJpy / exchangeRate
  }

  // Low stock aggregation across warehouses
  const skuTotals: Record<string, { total: number; name: string }> = {}
  for (const level of allLevels ?? []) {
    const sku = level.sku as Record<string, unknown> | null
    const skuId = sku?.sku_id as string
    if (!skuId) continue
    if (!skuTotals[skuId]) {
      skuTotals[skuId] = { total: 0, name: (sku?.sku_name as string) ?? '' }
    }
    skuTotals[skuId].total += level.quantity
  }
  const lowStockSkus = Object.entries(skuTotals).filter(([, v]) => v.total > 0 && v.total < 5)

  // Metric cards
  const metricCards = [
    { label: 'Active Leads', value: `${activeLeads ?? 0} leads` },
    { label: 'Contacted', value: `${contactedLeads ?? 0} contacted` },
    { label: 'Reply Rate', value: `${replyRate}%` },
    { label: 'Active Deals', value: `${activeOpps?.length ?? 0} deals` },
    { label: 'Inventory Value', value: `$${Math.round(inventoryValueUsd).toLocaleString()}` },
    { label: 'Low Stock', value: `${lowStockSkus.length} low`, alert: lowStockSkus.length > 0 },
    { label: 'Active Suppliers', value: `${(supplierData ?? []).filter((s) => s.stage === 'deal_established').length} active` },
    { label: 'Supplier Pipeline', value: `${(supplierData ?? []).filter((s) => s.stage !== 'deal_established' && s.stage !== 'ng').length} in pipeline` },
  ]

  // ── Focus Products ──
  const focusProductCategories = focusProductCategoriesSetting?.value ?? JSON.stringify({ price_sensitive: [], one_fits_all: [], edge: [] })

  // Build stock totals per product for focus display
  const productStockMap: Record<string, { jp: number; us: number; in_transit: number }> = {}
  for (const level of allInventoryLevels ?? []) {
    const sku = (allSkus ?? []).find((s) => s.sku_id === level.sku_id)
    if (!sku || !sku.product_id) continue
    const pid = sku.product_id
    if (!productStockMap[pid]) productStockMap[pid] = { jp: 0, us: 0, in_transit: 0 }
    const wh = level.warehouse as unknown as { short_code: string } | null
    const code = wh?.short_code ?? 'JP'
    if (code === 'JP') productStockMap[pid].jp += level.quantity
    else if (code === 'US') productStockMap[pid].us += level.quantity
    productStockMap[pid].in_transit += ((level as Record<string, unknown>).in_transit_qty as number ?? 0)
  }

  // ── Shipment Tasks ──
  // Build stock map for task items
  const taskStockMap: Record<string, Record<string, number>> = {}
  for (const level of allInventoryLevels ?? []) {
    const wh = level.warehouse as unknown as { short_code: string } | null
    const code = wh?.short_code ?? 'JP'
    if (!taskStockMap[level.sku_id]) taskStockMap[level.sku_id] = {}
    taskStockMap[level.sku_id][code] = level.quantity
  }

  // Assemble tasks with items
  const tasksWithItems = (shipmentTasks ?? []).map((task) => ({
    ...task,
    task_type: task.task_type as 'sample' | 'order',
    route: task.route as 'jp_to_us' | 'jp_to_cafe',
    status: task.status as 'open' | 'done',
    items: (shipmentTaskItems ?? [])
      .filter((i) => i.task_id === task.task_id)
      .map((i) => ({
        ...i,
        stock: taskStockMap[i.sku_id] ?? {},
      })),
  }))

  // Assemble US orders with items
  const usOrders = (usOrdersRaw ?? []).map((order) => ({
    ...order,
    items: (usOrderItemsRaw ?? [])
      .filter((i) => i.order_id === order.order_id)
      .map((i) => ({ sku_name: i.sku_name, quantity: i.quantity })),
  }))

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 shrink-0">
        <h1 className="text-2xl font-serif text-slate-900">Dashboard</h1>
        <p className="text-xs text-slate-500 mt-0.5">Overview of your operations</p>
      </div>
      <div className="flex-1 overflow-auto p-6 space-y-6">
      <DashboardFocusProducts
        allProducts={(allProducts ?? []).map((p) => ({
          product_id: p.product_id,
          customer_facing_product_name: p.customer_facing_product_name,
          selling_price_usd: p.selling_price_usd,
          gross_profit_margin: p.gross_profit_margin,
          jp_stock: productStockMap[p.product_id]?.jp ?? 0,
          us_stock: productStockMap[p.product_id]?.us ?? 0,
          in_transit: productStockMap[p.product_id]?.in_transit ?? 0,
        }))}
        focusProductCategories={focusProductCategories}
      />
      <DashboardShipments
        tasks={tasksWithItems as Parameters<typeof DashboardShipments>[0]['tasks']}
        usOrders={usOrders}
        skus={(allSkus ?? []).map((s) => ({ sku_id: s.sku_id, sku_name: s.sku_name, sku_type: s.sku_type }))}
        profiles={(teamProfiles ?? []).map((p) => ({ id: p.id, name: p.name }))}
      />
      </div>
    </div>
  )
}
