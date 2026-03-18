import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import ProductsTable from './ProductsTable'
import type { MarginThresholds } from '@/lib/margin-health'
import { DEFAULT_MARGIN_THRESHOLDS } from '@/lib/margin-health'

export default async function ProductsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient()

  const [{ data: profile }, { data: products }, { data: settings }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    service
      .from('products')
      .select('*')
      .order('active', { ascending: false })
      .order('customer_facing_product_name'),
    service
      .from('crm_settings')
      .select('key, value')
      .eq('category', 'margin_alerts'),
  ])

  const isAdmin = true // all authenticated users can edit products

  // Build margin thresholds from settings
  const thresholds: MarginThresholds = { ...DEFAULT_MARGIN_THRESHOLDS }
  if (settings) {
    for (const s of settings) {
      const v = parseFloat(s.value)
      if (isNaN(v)) continue
      if (s.key === 'margin_alert_red_profit_usd') thresholds.redProfitUsd = v
      if (s.key === 'margin_alert_red_margin_pct') thresholds.redMarginPct = v
      if (s.key === 'margin_alert_yellow_profit_usd') thresholds.yellowProfitUsd = v
      if (s.key === 'margin_alert_yellow_margin_pct') thresholds.yellowMarginPct = v
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <ProductsTable
        products={products ?? []}
        isAdmin={isAdmin}
        marginThresholds={thresholds}
      />
    </div>
  )
}
