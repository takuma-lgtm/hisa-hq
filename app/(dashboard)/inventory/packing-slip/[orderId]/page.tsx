import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export default async function PackingSlipPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { orderId } = await params
  const service = createServiceClient()

  const { data: order } = await service
    .from('us_outbound_orders')
    .select(`*, items:us_outbound_order_items(*)`)
    .eq('order_id', orderId)
    .single()

  if (!order) redirect('/inventory')

  // Get US warehouse address
  const { data: usWarehouse } = await service
    .from('warehouse_locations')
    .select('address')
    .eq('short_code', 'US')
    .single()

  // Get company info from crm_settings
  const { data: settings } = await service
    .from('crm_settings')
    .select('key, value')
    .in('key', ['company_name', 'company_phone', 'company_email'])

  const settingsMap: Record<string, string> = {}
  settings?.forEach(s => { settingsMap[s.key] = s.value })

  const companyName = settingsMap.company_name || 'Hisa Matcha'
  const companyPhone = settingsMap.company_phone || '+818047835681'
  const companyEmail = settingsMap.company_email || 'info@hisamatcha.com'
  const warehouseAddress = usWarehouse?.address || '8309 S 124th St\nSeattle, Washington 98178\nUnited States'

  const shipTo = [
    order.ship_to_name || order.customer_name,
    order.ship_to_address,
    [order.ship_to_city, order.ship_to_state, order.ship_to_zip].filter(Boolean).join(', '),
    order.ship_to_country,
  ].filter(Boolean).join('\n')

  const items = (order.items || []) as Array<{
    item_id: string
    sku_name: string
    product_description: string | null
    quantity: number
  }>

  return (
    <div className="min-h-screen bg-white print:bg-white">
      {/* Print button — hidden on print */}
      <div className="print:hidden fixed top-4 right-4 z-50">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700"
        >
          Print (Cmd+P)
        </button>
      </div>

      {/* Packing slip content */}
      <div className="max-w-[700px] mx-auto px-8 py-10 print:px-0 print:py-0 print:max-w-none">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <p className="text-sm text-slate-600 whitespace-pre-line">
              {companyName}
              {'\n'}TEL: {companyPhone}
              {'\n'}Email: {companyEmail}
            </p>
          </div>
          <div className="text-right">
            <h1 className="text-xl font-bold text-slate-900 mb-2">Packing Slip</h1>
            <div className="text-sm text-slate-600 space-y-1">
              <p>Order Number:</p>
              <p className="font-semibold text-slate-900">{order.order_number}</p>
              <p className="mt-2">Shipping Date:</p>
              <p className="font-semibold text-slate-900">
                {order.date_shipped || new Date().toLocaleDateString('en-US')}
              </p>
            </div>
          </div>
        </div>

        {/* Ship From / Ship To */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Ship From:</h2>
            <p className="text-sm text-slate-700 whitespace-pre-line">
              {companyName} US Warehouse
              {'\n'}{warehouseAddress}
            </p>
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Ship To:</h2>
            <p className="text-sm text-slate-700 whitespace-pre-line">{shipTo}</p>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full border-collapse mb-12">
          <thead>
            <tr className="border-b-2 border-slate-300">
              <th className="text-left py-2 text-sm font-semibold text-slate-700">Product Description</th>
              <th className="text-left py-2 text-sm font-semibold text-slate-700">Unit Type</th>
              <th className="text-right py-2 text-sm font-semibold text-slate-700">Order Quantity</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              // Parse unit type from sku_name (e.g. SC-3_30g → 30g)
              const parts = item.sku_name.split('_')
              const unitType = parts.length > 1 ? parts[parts.length - 1] : '—'
              const description = item.product_description || parts[0]
              return (
                <tr key={item.item_id} className="border-b border-slate-200">
                  <td className="py-2.5 text-sm text-slate-700">{description}</td>
                  <td className="py-2.5 text-sm text-slate-700">{unitType}</td>
                  <td className="py-2.5 text-sm text-slate-700 text-right">{item.quantity}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Footer */}
        <div className="border-t border-slate-200 pt-6">
          <p className="text-sm text-slate-500 italic">
            Thank you for partnering with Hisa Matcha.
            {'\n'}If you have any questions regarding this shipment, please contact us at {companyEmail}.
          </p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            margin: 1in;
            size: letter;
          }
          nav, header, aside, [class*="Sidebar"] {
            display: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </div>
  )
}
