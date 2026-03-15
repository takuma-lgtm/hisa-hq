import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: opportunityId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const batchId = request.nextUrl.searchParams.get('batch_id')
  if (!batchId) return NextResponse.json({ error: 'batch_id is required' }, { status: 400 })

  const service = createServiceClient()

  // Fetch batch + items with product names
  const { data: batch, error: batchErr } = await service
    .from('sample_batches')
    .select(`
      *,
      items:sample_batch_items(
        *,
        sku:skus(sku_name, name_external_eng, unit_weight_kg)
      )
    `)
    .eq('batch_id', batchId)
    .eq('opportunity_id', opportunityId)
    .single()

  if (batchErr || !batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const batchData = batch as any

  // Fetch opportunity + customer
  const { data: opportunity } = await service
    .from('opportunities')
    .select(`
      opportunity_id,
      customer:customers(cafe_name, contact_person, address, city, state, zip_code, country, phone, email)
    `)
    .eq('opportunity_id', opportunityId)
    .single()

  const customer = (opportunity as Record<string, unknown>)?.customer as Record<string, string> | null

  // Fetch company settings
  const { data: settings } = await service
    .from('crm_settings')
    .select('key, value')
    .eq('category', 'company')

  const getSetting = (key: string) => settings?.find((s) => s.key === key)?.value ?? ''

  // Fetch ship-from warehouse
  const shipFrom = batchData.ship_from ?? 'US Warehouse'
  const { data: warehouse } = await service
    .from('warehouse_locations')
    .select('name, address, country')
    .eq('name', shipFrom)
    .single()

  const shippedDate = batchData.date_shipped
    ? new Date(batchData.date_shipped).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date(batchData.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const customerAddress = [
    customer?.address,
    [customer?.city, customer?.state, customer?.zip_code].filter(Boolean).join(', '),
    customer?.country,
  ].filter(Boolean).join('\n')

  const itemsHtml = (batchData.items ?? []).map((item: Record<string, unknown>) => {
    const sku = item.sku as Record<string, unknown> | null
    const name = sku?.name_external_eng ?? sku?.sku_name ?? item.product_snapshot ?? 'Sample'
    const weightG = sku?.unit_weight_kg ? Number(sku.unit_weight_kg) * 1000 : null
    const weightLabel = weightG ? `${weightG}g` : '—'
    const qty = item.qty_grams ?? 1
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${weightLabel}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${qty}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Packing Slip — ${customer?.cafe_name ?? 'Customer'}</title>
  <style>
    @media print { body { margin: 0; } }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
    .company { font-size: 14px; color: #6b7280; }
    .company h1 { font-size: 24px; color: #1f2937; margin: 0 0 4px 0; }
    .slip-title { font-size: 20px; font-weight: 600; text-align: right; }
    .slip-meta { font-size: 13px; color: #6b7280; text-align: right; margin-top: 4px; }
    .addresses { display: flex; gap: 48px; margin-bottom: 32px; }
    .address-block { flex: 1; }
    .address-block h3 { font-size: 12px; text-transform: uppercase; color: #9ca3af; margin: 0 0 8px; letter-spacing: 0.05em; }
    .address-block p { margin: 0; font-size: 14px; white-space: pre-line; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    th { padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; }
    .footer { font-size: 13px; color: #6b7280; text-align: center; margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
    .tracking { font-size: 13px; color: #6b7280; margin-bottom: 24px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">
      <h1>${getSetting('company_name') || 'Hisa Matcha'}</h1>
      <div>TEL: ${getSetting('company_phone')}</div>
      <div>Email: ${getSetting('company_email')}</div>
    </div>
    <div>
      <div class="slip-title">Packing Slip</div>
      <div class="slip-meta">
        Shipping Date: ${shippedDate}<br>
        ${batchData.carrier ? `Carrier: ${batchData.carrier}` : ''}
        ${batchData.tracking_number ? `<br>Tracking: ${batchData.tracking_number}` : ''}
      </div>
    </div>
  </div>

  <div class="addresses">
    <div class="address-block">
      <h3>Ship From</h3>
      <p>${warehouse?.name ?? shipFrom}\n${warehouse?.address ?? ''}</p>
    </div>
    <div class="address-block">
      <h3>Ship To</h3>
      <p>${customer?.cafe_name ?? ''}\n${customer?.contact_person ? `Attn: ${customer.contact_person}\n` : ''}${customerAddress}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Product Description</th>
        <th style="text-align:center">Unit Type</th>
        <th style="text-align:center">Quantity</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="footer">
    Thank you for partnering with ${getSetting('company_name') || 'Hisa Matcha'}.<br>
    If you have any questions regarding this shipment, please contact us at ${getSetting('company_email')}.
  </div>

  <script>window.print()</script>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
