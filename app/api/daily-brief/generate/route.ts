import { NextResponse } from 'next/server'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { createServiceClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Cron-compatible API route for generating daily briefs
// Called by Vercel Cron at 9am JST (0:00 UTC)
// ---------------------------------------------------------------------------

const ACTIVE_OPP_STAGES = [
  'lead_created', 'outreach_sent', 'cafe_replied', 'get_info',
  'product_guide_sent', 'sample_approved', 'samples_shipped',
  'samples_delivered', 'quote_sent', 'collect_feedback',
  'deal_won', 'payment_received', 'first_order',
] as const

const OPP_STAGE_LABELS: Record<string, string> = {
  lead_created: 'Lead Created', outreach_sent: 'Outreach Sent',
  cafe_replied: 'Cafe Replied', get_info: 'Get Info',
  product_guide_sent: 'Product Guide Sent', sample_approved: 'Sample Approved',
  samples_shipped: 'Samples Shipped', samples_delivered: 'Samples Delivered',
  quote_sent: 'Quote Sent', collect_feedback: 'Collect Feedback',
  deal_won: 'Deal Won', payment_received: 'Payment Received',
  first_order: 'First Order', recurring_customer: 'Recurring',
  disqualified: 'Disqualified', lost: 'Lost',
}

const LEAD_STAGE_LABELS: Record<string, string> = {
  new_lead: 'New', contacted: 'Contacted', replied: 'Replied',
  qualified: 'Qualified', handed_off: 'Handed Off', disqualified: 'Disqualified',
}

interface DailyBriefData {
  generatedAt: string
  metrics: {
    activeLeads: number
    leadsByStage: Record<string, number>
    activeOpportunities: number
    opportunitiesByStage: Record<string, number>
    recurringCustomers: number
    wonThisMonth: number
    lostThisMonth: number
    lowStockSkus: { name: string; quantity: number }[]
  }
  attentionItems: {
    staleLeads: { cafeName: string; daysSinceContact: number }[]
    staleQuotes: { cafeName: string; daysInStage: number }[]
    samplesAwaitingFeedback: { cafeName: string; deliveredDaysAgo: number }[]
    inTransitSamples: { cafeName: string; trackingNumber: string }[]
  }
  supplierPipeline: Record<string, number>
}

function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  if (authHeader.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
}

export async function POST(request: Request) {
  // Verify cron secret (timing-safe comparison)
  if (!process.env.CRON_SECRET || !verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()

  // --- Parallel queries ---
  const [
    { count: activeLeads },
    { data: leadStages },
    { data: opportunities },
    { count: recurringCount },
    { count: wonThisMonth },
    { count: lostThisMonth },
    { data: inventoryLevels },
    { data: staleLeads },
    { data: staleOpps },
    { data: samplesNoFeedback },
    { data: inTransitSamples },
    { data: suppliers },
  ] = await Promise.all([
    service.from('customers').select('*', { count: 'exact', head: true }).eq('status', 'lead').neq('lead_stage', 'disqualified'),
    service.from('customers').select('lead_stage').eq('status', 'lead').neq('lead_stage', 'disqualified'),
    service.from('opportunities').select('opportunity_id, stage, updated_at, customers(cafe_name)').in('stage', ACTIVE_OPP_STAGES),
    service.from('opportunities').select('*', { count: 'exact', head: true }).eq('stage', 'recurring_customer'),
    service.from('opportunities').select('*', { count: 'exact', head: true }).eq('stage', 'deal_won').gte('updated_at', firstOfMonth),
    service.from('opportunities').select('*', { count: 'exact', head: true }).in('stage', ['lost', 'disqualified']).gte('updated_at', firstOfMonth),
    service.from('inventory_levels').select('quantity, sku:skus(sku_name, name_external_eng)').lt('quantity', 5),
    service.from('customers').select('cafe_name, date_contacted').eq('status', 'lead').eq('lead_stage', 'contacted').lt('date_contacted', threeDaysAgo).order('date_contacted').limit(10),
    service.from('opportunities').select('stage, updated_at, customers(cafe_name)').eq('stage', 'quote_sent').lt('updated_at', fiveDaysAgo).order('updated_at').limit(10),
    service.from('sample_batches').select('delivered_at, feedback_notes, customers(cafe_name)').not('delivered_at', 'is', null).is('feedback_notes', null).order('delivered_at').limit(10),
    service.from('sample_batches').select('tracking_number, customers(cafe_name)').not('tracking_number', 'is', null).neq('delivery_status', 'Delivered').limit(10),
    service.from('suppliers').select('stage'),
  ])

  // --- Aggregate data ---
  const leadsByStage: Record<string, number> = {}
  for (const row of leadStages ?? []) { const s = (row as { lead_stage: string }).lead_stage; leadsByStage[s] = (leadsByStage[s] ?? 0) + 1 }

  const opportunitiesByStage: Record<string, number> = {}
  for (const row of opportunities ?? []) { const s = (row as { stage: string }).stage; opportunitiesByStage[s] = (opportunitiesByStage[s] ?? 0) + 1 }

  const lowStockSkus = (inventoryLevels ?? []).map((row: Record<string, unknown>) => {
    const sku = row.sku as { sku_name: string; name_external_eng: string | null } | null
    return { name: sku?.name_external_eng ?? sku?.sku_name ?? 'Unknown', quantity: row.quantity as number }
  })

  const staleLeadItems = (staleLeads ?? []).map((row: Record<string, unknown>) => {
    const days = Math.floor((now.getTime() - new Date(row.date_contacted as string).getTime()) / (1000 * 60 * 60 * 24))
    return { cafeName: row.cafe_name as string, daysSinceContact: days }
  })

  const staleQuoteItems = (staleOpps ?? []).map((row: Record<string, unknown>) => {
    const customer = row.customers as { cafe_name: string } | null
    const days = Math.floor((now.getTime() - new Date(row.updated_at as string).getTime()) / (1000 * 60 * 60 * 24))
    return { cafeName: customer?.cafe_name ?? 'Unknown', daysInStage: days }
  })

  const samplesAwaitingItems = (samplesNoFeedback ?? []).map((row: Record<string, unknown>) => {
    const customer = row.customers as { cafe_name: string } | null
    const days = Math.floor((now.getTime() - new Date(row.delivered_at as string).getTime()) / (1000 * 60 * 60 * 24))
    return { cafeName: customer?.cafe_name ?? 'Unknown', deliveredDaysAgo: days }
  })

  const inTransitItems = (inTransitSamples ?? []).map((row: Record<string, unknown>) => {
    const customer = row.customers as { cafe_name: string } | null
    return { cafeName: customer?.cafe_name ?? 'Unknown', trackingNumber: row.tracking_number as string }
  })

  const supplierPipeline: Record<string, number> = {}
  for (const row of suppliers ?? []) { const s = (row as { stage: string }).stage; supplierPipeline[s] = (supplierPipeline[s] ?? 0) + 1 }

  const data: DailyBriefData = {
    generatedAt: now.toISOString(),
    metrics: { activeLeads: activeLeads ?? 0, leadsByStage, activeOpportunities: opportunities?.length ?? 0, opportunitiesByStage, recurringCustomers: recurringCount ?? 0, wonThisMonth: wonThisMonth ?? 0, lostThisMonth: lostThisMonth ?? 0, lowStockSkus },
    attentionItems: { staleLeads: staleLeadItems, staleQuotes: staleQuoteItems, samplesAwaitingFeedback: samplesAwaitingItems, inTransitSamples: inTransitItems },
    supplierPipeline,
  }

  // --- Format ---
  const briefHtml = formatBriefHtml(data)
  const briefText = formatBriefText(data)
  const token = crypto.randomUUID()

  // --- Save ---
  const { error } = await service.from('daily_briefs').insert({ token, brief_data: data as unknown as Record<string, unknown>, brief_html: briefHtml, brief_text: briefText })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // --- Email ---
  const gmailUser = process.env.GMAIL_USER
  const gmailPass = process.env.GMAIL_APP_PASSWORD
  const emailTo = process.env.BRIEF_EMAIL_TO
  const baseUrl = process.env.BRIEF_BASE_URL ?? 'https://crm.hisamatcha.com'

  if (gmailUser && gmailPass && emailTo) {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 587, secure: false,
      auth: { user: gmailUser, pass: gmailPass },
    })

    const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Tokyo' })
    const briefUrl = `${baseUrl}/daily-brief/${token}`

    await transporter.sendMail({
      from: gmailUser,
      to: emailTo,
      subject: `HISA Daily Brief — ${date}`,
      html: `${briefHtml}
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
          <a href="${briefUrl}" style="display: inline-block; background: #15803d; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
            View Full Brief & Post to Chat →
          </a>
        </div>`,
    })
  }

  return NextResponse.json({ success: true, token })
}

// ---------------------------------------------------------------------------
// Formatters (same as scripts/daily-brief.ts)
// ---------------------------------------------------------------------------

function formatBriefHtml(data: DailyBriefData): string {
  const date = new Date(data.generatedAt).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo',
  })
  const attentionCount = data.attentionItems.staleLeads.length + data.attentionItems.staleQuotes.length + data.attentionItems.samplesAwaitingFeedback.length + data.attentionItems.inTransitSamples.length

  let html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto; color: #1e293b;">
  <h1 style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">HISA Matcha — Daily Brief</h1>
  <p style="font-size: 13px; color: #64748b; margin-bottom: 24px;">${date}</p>
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;"><div style="font-size: 20px; font-weight: 700;">${data.metrics.activeLeads}</div><div style="font-size: 11px; color: #64748b;">Active Leads</div></div>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;"><div style="font-size: 20px; font-weight: 700;">${data.metrics.activeOpportunities}</div><div style="font-size: 11px; color: #64748b;">Active Opps</div></div>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;"><div style="font-size: 20px; font-weight: 700;">${data.metrics.recurringCustomers}</div><div style="font-size: 11px; color: #64748b;">Recurring</div></div>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;"><div style="font-size: 20px; font-weight: 700; color: ${attentionCount > 0 ? '#dc2626' : '#16a34a'};">${attentionCount}</div><div style="font-size: 11px; color: #64748b;">Need Attention</div></div>
  </div>`

  const leadEntries = Object.entries(data.metrics.leadsByStage)
  if (leadEntries.length > 0) {
    html += `<h2 style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Lead Pipeline</h2>
    <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 20px;">${leadEntries.map(([stage, count]) => `<tr><td style="padding: 4px 0; color: #475569;">${LEAD_STAGE_LABELS[stage] ?? stage}</td><td style="text-align: right; font-weight: 600;">${count}</td></tr>`).join('')}</table>`
  }

  const oppEntries = Object.entries(data.metrics.opportunitiesByStage)
  if (oppEntries.length > 0) {
    html += `<h2 style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Opportunity Pipeline</h2>
    <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 20px;">${oppEntries.map(([stage, count]) => `<tr><td style="padding: 4px 0; color: #475569;">${OPP_STAGE_LABELS[stage] ?? stage}</td><td style="text-align: right; font-weight: 600;">${count}</td></tr>`).join('')}
    <tr style="border-top: 1px solid #e2e8f0;"><td style="padding: 4px 0; color: #16a34a;">Won this month</td><td style="text-align: right; font-weight: 600;">${data.metrics.wonThisMonth}</td></tr>
    <tr><td style="padding: 4px 0; color: #dc2626;">Lost this month</td><td style="text-align: right; font-weight: 600;">${data.metrics.lostThisMonth}</td></tr></table>`
  }

  if (attentionCount > 0) {
    html += `<h2 style="font-size: 11px; font-weight: 600; color: #dc2626; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Needs Attention</h2>
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 13px;">`
    for (const item of data.attentionItems.staleLeads) html += `<div style="padding: 3px 0;">🔴 <strong>${item.cafeName}</strong> — contacted ${item.daysSinceContact} days ago, no reply</div>`
    for (const item of data.attentionItems.staleQuotes) html += `<div style="padding: 3px 0;">🟡 <strong>${item.cafeName}</strong> — quote sent ${item.daysInStage} days ago, no response</div>`
    for (const item of data.attentionItems.samplesAwaitingFeedback) html += `<div style="padding: 3px 0;">🟠 <strong>${item.cafeName}</strong> — samples delivered ${item.deliveredDaysAgo} days ago, no feedback</div>`
    for (const item of data.attentionItems.inTransitSamples) html += `<div style="padding: 3px 0;">📦 <strong>${item.cafeName}</strong> — in transit (${item.trackingNumber})</div>`
    html += `</div>`
  }

  if (data.metrics.lowStockSkus.length > 0) {
    html += `<h2 style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Low Stock</h2>
    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 13px;">${data.metrics.lowStockSkus.map(s => `<div style="padding: 2px 0;">${s.name}: <strong>${s.quantity}</strong> units</div>`).join('')}</div>`
  }

  const supplierEntries = Object.entries(data.supplierPipeline)
  if (supplierEntries.length > 0) {
    html += `<h2 style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Supplier Pipeline</h2>
    <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 20px;">${supplierEntries.map(([stage, count]) => `<tr><td style="padding: 4px 0; color: #475569;">${stage.replace(/_/g, ' ')}</td><td style="text-align: right; font-weight: 600;">${count}</td></tr>`).join('')}</table>`
  }

  html += `</div>`
  return html
}

function formatBriefText(data: DailyBriefData): string {
  const date = new Date(data.generatedAt).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo',
  })
  let text = `*HISA Matcha — Daily Brief*\n${date}\n\n`
  text += `*Summary*\nActive Leads: ${data.metrics.activeLeads}\nActive Opportunities: ${data.metrics.activeOpportunities}\nRecurring Customers: ${data.metrics.recurringCustomers}\nWon this month: ${data.metrics.wonThisMonth} | Lost: ${data.metrics.lostThisMonth}\n\n`

  const leadEntries = Object.entries(data.metrics.leadsByStage)
  if (leadEntries.length > 0) { text += `*Lead Pipeline*\n`; for (const [stage, count] of leadEntries) text += `  ${LEAD_STAGE_LABELS[stage] ?? stage}: ${count}\n`; text += '\n' }

  const oppEntries = Object.entries(data.metrics.opportunitiesByStage)
  if (oppEntries.length > 0) { text += `*Opportunity Pipeline*\n`; for (const [stage, count] of oppEntries) text += `  ${OPP_STAGE_LABELS[stage] ?? stage}: ${count}\n`; text += '\n' }

  const attentionCount = data.attentionItems.staleLeads.length + data.attentionItems.staleQuotes.length + data.attentionItems.samplesAwaitingFeedback.length + data.attentionItems.inTransitSamples.length
  if (attentionCount > 0) {
    text += `*⚠️ Needs Attention*\n`
    for (const item of data.attentionItems.staleLeads) text += `  🔴 ${item.cafeName} — contacted ${item.daysSinceContact}d ago, no reply\n`
    for (const item of data.attentionItems.staleQuotes) text += `  🟡 ${item.cafeName} — quote sent ${item.daysInStage}d ago\n`
    for (const item of data.attentionItems.samplesAwaitingFeedback) text += `  🟠 ${item.cafeName} — delivered ${item.deliveredDaysAgo}d ago, no feedback\n`
    for (const item of data.attentionItems.inTransitSamples) text += `  📦 ${item.cafeName} — in transit (${item.trackingNumber})\n`
    text += '\n'
  }

  if (data.metrics.lowStockSkus.length > 0) { text += `*Low Stock*\n`; for (const s of data.metrics.lowStockSkus) text += `  ${s.name}: ${s.quantity} units\n`; text += '\n' }

  const supplierEntries = Object.entries(data.supplierPipeline)
  if (supplierEntries.length > 0) { text += `*Supplier Pipeline*\n`; for (const [stage, count] of supplierEntries) text += `  ${stage.replace(/_/g, ' ')}: ${count}\n` }

  return text.trim()
}
