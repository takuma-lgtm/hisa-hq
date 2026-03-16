import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { OPPORTUNITY_TABLE_STAGES } from '@/lib/constants'
import { Clock, AlertTriangle, CircleAlert, Package, Sprout, MessageCircle, Phone, FileText, Gift } from 'lucide-react'
import DashboardMetrics from './components/DashboardMetrics'
import DashboardNeedsAttention, { type AttentionItem } from './components/DashboardNeedsAttention'
import DashboardPipeline from './components/DashboardPipeline'
import DashboardActivity, { type ActivityItem } from './components/DashboardActivity'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient()
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()

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
    { data: staleLeads },
    { data: staleOpps },
    { data: inTransitBatches },
    { count: wonThisMonth },
    { count: lostThisMonth },
    { data: recentMessages },
    { data: recentTransactions },
    { data: recentCalls },
    { data: recentProposals },
    { data: recentSamples },
    { data: supplierData },
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
    // Attention: Stale leads (contacted > 3 days ago, no reply)
    service
      .from('customers')
      .select('customer_id, cafe_name, date_contacted')
      .eq('status', 'lead')
      .eq('lead_stage', 'contacted')
      .lt('date_contacted', threeDaysAgo)
      .order('date_contacted')
      .limit(5),
    // Attention: Stale opportunities
    service
      .from('opportunities')
      .select('opportunity_id, stage, updated_at, customers(cafe_name)')
      .in('stage', OPPORTUNITY_TABLE_STAGES)
      .lt('updated_at', fiveDaysAgo)
      .order('updated_at')
      .limit(5),
    // Attention: In-transit sample batches
    service
      .from('sample_batches')
      .select('batch_id, tracking_number, customer_id, ship_from')
      .not('tracking_number', 'is', null)
      .neq('delivery_status', 'Delivered')
      .limit(5),
    // Pipeline: Won this month
    service
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('stage', 'deal_won')
      .gte('updated_at', firstOfMonth),
    // Pipeline: Lost this month
    service
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
      .in('stage', ['lost', 'disqualified'])
      .gte('updated_at', firstOfMonth),
    // Activity: Messages
    service
      .from('instagram_logs')
      .select('log_id, created_at, message_sent, customer_id')
      .order('created_at', { ascending: false })
      .limit(10),
    // Activity: Inventory transactions
    service
      .from('inventory_transactions')
      .select('transaction_id, created_at, transaction_ref, qty_change, movement_type, sku:skus(sku_name)')
      .order('created_at', { ascending: false })
      .limit(10),
    // Activity: Calls
    service
      .from('call_logs')
      .select('log_id, created_at, call_type, customer_id')
      .order('created_at', { ascending: false })
      .limit(10),
    // Activity: Proposals
    service
      .from('opportunity_proposals')
      .select('proposal_id, created_at, opportunity_id, sent_via')
      .order('created_at', { ascending: false })
      .limit(10),
    // Activity: Sample batches
    service
      .from('sample_batches')
      .select('batch_id, created_at, customer_id, ship_from')
      .order('created_at', { ascending: false })
      .limit(10),
    // Supplier pipeline
    service
      .from('suppliers')
      .select('supplier_id, stage, sample_status'),
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
  const outOfStockSkus = Object.entries(skuTotals).filter(([, v]) => v.total === 0)

  // Pipeline stage counts
  const stageCounts: Record<string, number> = {}
  for (const opp of activeOpps ?? []) {
    stageCounts[opp.stage] = (stageCounts[opp.stage] ?? 0) + 1
  }

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

  // Needs attention items
  const attentionItems: AttentionItem[] = []

  for (const lead of staleLeads ?? []) {
    const days = Math.floor((now.getTime() - new Date(lead.date_contacted ?? '').getTime()) / 86400000)
    attentionItems.push({
      icon: <Clock className="w-4 h-4 text-amber-500" />,
      label: `${lead.cafe_name} — no reply in ${days} days`,
      href: '/leads',
    })
  }

  for (const opp of staleOpps ?? []) {
    const cust = opp.customers as Record<string, unknown> | null
    const days = Math.floor((now.getTime() - new Date(opp.updated_at).getTime()) / 86400000)
    attentionItems.push({
      icon: <Clock className="w-4 h-4 text-amber-500" />,
      label: `${cust?.cafe_name ?? 'Unknown'} — in stage for ${days} days`,
      href: `/opportunities?selected=${opp.opportunity_id}`,
    })
  }

  for (const [, sku] of lowStockSkus.slice(0, 3)) {
    attentionItems.push({
      icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
      label: `${sku.name} — ${sku.total} units remaining`,
      href: '/inventory',
    })
  }

  for (const [, sku] of outOfStockSkus.slice(0, 2)) {
    attentionItems.push({
      icon: <CircleAlert className="w-4 h-4 text-red-500" />,
      label: `${sku.name} — out of stock`,
      href: '/inventory',
    })
  }

  for (const batch of inTransitBatches ?? []) {
    attentionItems.push({
      icon: <Package className="w-4 h-4 text-blue-500" />,
      label: `Samples (${batch.tracking_number}) — in transit from ${batch.ship_from}`,
      href: '/inventory',
    })
  }

  // Supplier attention items
  const awaitingSamples = (supplierData ?? []).filter((s) => s.sample_status === 'waiting')
  if (awaitingSamples.length > 0) {
    attentionItems.push({
      icon: <Sprout className="w-4 h-4 text-green-600" />,
      label: `${awaitingSamples.length} supplier(s) awaiting samples`,
      href: '/suppliers',
    })
  }

  // Activity feed — merge and sort
  const activities: ActivityItem[] = []

  for (const msg of recentMessages ?? []) {
    activities.push({
      icon: <MessageCircle className="w-4 h-4 text-blue-500" />,
      description: msg.message_sent ? `Sent: "${msg.message_sent.slice(0, 50)}${msg.message_sent.length > 50 ? '…' : ''}"` : 'Message sent',
      timestamp: msg.created_at,
      href: '/leads',
    })
  }

  for (const tx of recentTransactions ?? []) {
    const sku = tx.sku as Record<string, unknown> | null
    activities.push({
      icon: <Package className="w-4 h-4 text-slate-500" />,
      description: `${tx.transaction_ref ?? tx.movement_type}: ${tx.qty_change} × ${sku?.sku_name ?? 'SKU'}`,
      timestamp: tx.created_at,
      href: '/inventory',
    })
  }

  for (const call of recentCalls ?? []) {
    activities.push({
      icon: <Phone className="w-4 h-4 text-green-500" />,
      description: `${call.call_type} call logged`,
      timestamp: call.created_at,
      href: '/opportunities',
    })
  }

  for (const prop of recentProposals ?? []) {
    activities.push({
      icon: <FileText className="w-4 h-4 text-slate-500" />,
      description: `Quote created via ${prop.sent_via}`,
      timestamp: prop.created_at,
      href: '/opportunities',
    })
  }

  for (const batch of recentSamples ?? []) {
    activities.push({
      icon: <Gift className="w-4 h-4 text-purple-500" />,
      description: `Samples shipped from ${batch.ship_from}`,
      timestamp: batch.created_at,
      href: '/opportunities',
    })
  }

  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 shrink-0">
        <h1 className="text-2xl font-serif text-slate-900">Dashboard</h1>
        <p className="text-xs text-slate-500 mt-0.5">Overview of your operations</p>
      </div>
      <div className="flex-1 overflow-auto p-6 space-y-6">
      <DashboardMetrics cards={metricCards} />
      <DashboardNeedsAttention items={attentionItems.slice(0, 10)} />
      <DashboardPipeline
        stageCounts={stageCounts}
        wonThisMonth={wonThisMonth ?? 0}
        lostThisMonth={lostThisMonth ?? 0}
      />
      <DashboardActivity activities={activities.slice(0, 10)} />
      </div>
    </div>
  )
}
