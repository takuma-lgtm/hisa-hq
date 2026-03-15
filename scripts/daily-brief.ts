/**
 * Daily Brief Generator
 *
 * Generates a daily operational summary of CRM data and emails it with a link
 * to view the full brief and post to Google Chat.
 *
 * Usage:
 *   npx tsx scripts/daily-brief.ts
 *
 * Cron (9am JST = 0:00 UTC):
 *   0 0 * * * cd /path/to/hisa-crm && npx tsx scripts/daily-brief.ts
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 *   BRIEF_EMAIL_TO, BRIEF_BASE_URL
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

// ---------------------------------------------------------------------------
// Env loading (same pattern as seed-suppliers.ts)
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    } else {
      const hashIdx = value.indexOf('   #')
      if (hashIdx > 0) value = value.slice(0, hashIdx).trim()
    }
    if (!process.env[key]) process.env[key] = value
  }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ---------------------------------------------------------------------------
// Stage constants (hardcoded — scripts can't use @/ path aliases)
// ---------------------------------------------------------------------------

const ACTIVE_OPP_STAGES = [
  'lead_created', 'outreach_sent', 'cafe_replied', 'get_info',
  'product_guide_sent', 'sample_approved', 'samples_shipped',
  'samples_delivered', 'quote_sent', 'collect_feedback',
  'deal_won', 'payment_received', 'first_order',
]

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

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Data generation
// ---------------------------------------------------------------------------

async function generateBriefData(): Promise<DailyBriefData> {
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()

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
    // Active leads count
    supabase.from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'lead')
      .neq('lead_stage', 'disqualified'),
    // Leads by stage
    supabase.from('customers')
      .select('lead_stage')
      .eq('status', 'lead')
      .neq('lead_stage', 'disqualified'),
    // Active opportunities
    supabase.from('opportunities')
      .select('opportunity_id, stage, updated_at, customers(cafe_name)')
      .in('stage', ACTIVE_OPP_STAGES),
    // Recurring customers
    supabase.from('opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('stage', 'recurring_customer'),
    // Won this month
    supabase.from('opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('stage', 'deal_won')
      .gte('updated_at', firstOfMonth),
    // Lost this month
    supabase.from('opportunities')
      .select('*', { count: 'exact', head: true })
      .in('stage', ['lost', 'disqualified'])
      .gte('updated_at', firstOfMonth),
    // Inventory levels (low stock < 5)
    supabase.from('inventory_levels')
      .select('quantity, sku:skus(sku_name, name_external_eng)')
      .lt('quantity', 5),
    // Stale leads (contacted 3+ days ago, no reply)
    supabase.from('customers')
      .select('cafe_name, date_contacted')
      .eq('status', 'lead')
      .eq('lead_stage', 'contacted')
      .lt('date_contacted', threeDaysAgo)
      .order('date_contacted')
      .limit(10),
    // Stale quotes (quote_sent 5+ days, no update)
    supabase.from('opportunities')
      .select('stage, updated_at, customers(cafe_name)')
      .eq('stage', 'quote_sent')
      .lt('updated_at', fiveDaysAgo)
      .order('updated_at')
      .limit(10),
    // Samples delivered but no feedback
    supabase.from('sample_batches')
      .select('delivered_at, feedback_notes, customers(cafe_name)')
      .not('delivered_at', 'is', null)
      .is('feedback_notes', null)
      .order('delivered_at')
      .limit(10),
    // In-transit samples
    supabase.from('sample_batches')
      .select('tracking_number, customers(cafe_name)')
      .not('tracking_number', 'is', null)
      .neq('delivery_status', 'Delivered')
      .limit(10),
    // Supplier pipeline
    supabase.from('suppliers')
      .select('stage'),
  ])

  // Aggregate leads by stage
  const leadsByStage: Record<string, number> = {}
  for (const row of leadStages ?? []) {
    const s = (row as { lead_stage: string }).lead_stage
    leadsByStage[s] = (leadsByStage[s] ?? 0) + 1
  }

  // Aggregate opportunities by stage
  const opportunitiesByStage: Record<string, number> = {}
  for (const row of opportunities ?? []) {
    const s = (row as { stage: string }).stage
    opportunitiesByStage[s] = (opportunitiesByStage[s] ?? 0) + 1
  }

  // Low stock SKUs
  const lowStockSkus = (inventoryLevels ?? []).map((row: Record<string, unknown>) => {
    const sku = row.sku as { sku_name: string; name_external_eng: string | null } | null
    return { name: sku?.name_external_eng ?? sku?.sku_name ?? 'Unknown', quantity: row.quantity as number }
  })

  // Stale leads
  const staleLeadItems = (staleLeads ?? []).map((row: Record<string, unknown>) => {
    const days = Math.floor((now.getTime() - new Date(row.date_contacted as string).getTime()) / (1000 * 60 * 60 * 24))
    return { cafeName: row.cafe_name as string, daysSinceContact: days }
  })

  // Stale quotes
  const staleQuoteItems = (staleOpps ?? []).map((row: Record<string, unknown>) => {
    const customer = row.customers as { cafe_name: string } | null
    const days = Math.floor((now.getTime() - new Date(row.updated_at as string).getTime()) / (1000 * 60 * 60 * 24))
    return { cafeName: customer?.cafe_name ?? 'Unknown', daysInStage: days }
  })

  // Samples awaiting feedback
  const samplesAwaitingItems = (samplesNoFeedback ?? []).map((row: Record<string, unknown>) => {
    const customer = row.customers as { cafe_name: string } | null
    const days = Math.floor((now.getTime() - new Date(row.delivered_at as string).getTime()) / (1000 * 60 * 60 * 24))
    return { cafeName: customer?.cafe_name ?? 'Unknown', deliveredDaysAgo: days }
  })

  // In-transit
  const inTransitItems = (inTransitSamples ?? []).map((row: Record<string, unknown>) => {
    const customer = row.customers as { cafe_name: string } | null
    return { cafeName: customer?.cafe_name ?? 'Unknown', trackingNumber: row.tracking_number as string }
  })

  // Supplier pipeline by stage
  const supplierPipeline: Record<string, number> = {}
  for (const row of suppliers ?? []) {
    const s = (row as { stage: string }).stage
    supplierPipeline[s] = (supplierPipeline[s] ?? 0) + 1
  }

  return {
    generatedAt: now.toISOString(),
    metrics: {
      activeLeads: activeLeads ?? 0,
      leadsByStage,
      activeOpportunities: opportunities?.length ?? 0,
      opportunitiesByStage,
      recurringCustomers: recurringCount ?? 0,
      wonThisMonth: wonThisMonth ?? 0,
      lostThisMonth: lostThisMonth ?? 0,
      lowStockSkus,
    },
    attentionItems: {
      staleLeads: staleLeadItems,
      staleQuotes: staleQuoteItems,
      samplesAwaitingFeedback: samplesAwaitingItems,
      inTransitSamples: inTransitItems,
    },
    supplierPipeline,
  }
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatBriefHtml(data: DailyBriefData): string {
  const date = new Date(data.generatedAt).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Tokyo',
  })

  const attentionCount =
    data.attentionItems.staleLeads.length +
    data.attentionItems.staleQuotes.length +
    data.attentionItems.samplesAwaitingFeedback.length +
    data.attentionItems.inTransitSamples.length

  let html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto; color: #1e293b;">
  <h1 style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">HISA Matcha — Daily Brief</h1>
  <p style="font-size: 13px; color: #64748b; margin-bottom: 24px;">${date}</p>

  <!-- Summary Metrics -->
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 20px; font-weight: 700;">${data.metrics.activeLeads}</div>
      <div style="font-size: 11px; color: #64748b;">Active Leads</div>
    </div>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 20px; font-weight: 700;">${data.metrics.activeOpportunities}</div>
      <div style="font-size: 11px; color: #64748b;">Active Opps</div>
    </div>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 20px; font-weight: 700;">${data.metrics.recurringCustomers}</div>
      <div style="font-size: 11px; color: #64748b;">Recurring</div>
    </div>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 20px; font-weight: 700; color: ${attentionCount > 0 ? '#dc2626' : '#16a34a'};">${attentionCount}</div>
      <div style="font-size: 11px; color: #64748b;">Need Attention</div>
    </div>
  </div>`

  // Lead pipeline
  const leadEntries = Object.entries(data.metrics.leadsByStage)
  if (leadEntries.length > 0) {
    html += `
  <h2 style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Lead Pipeline</h2>
  <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 20px;">
    ${leadEntries.map(([stage, count]) => `
    <tr><td style="padding: 4px 0; color: #475569;">${LEAD_STAGE_LABELS[stage] ?? stage}</td><td style="text-align: right; font-weight: 600;">${count}</td></tr>`).join('')}
  </table>`
  }

  // Opportunity pipeline
  const oppEntries = Object.entries(data.metrics.opportunitiesByStage)
  if (oppEntries.length > 0) {
    html += `
  <h2 style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Opportunity Pipeline</h2>
  <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 20px;">
    ${oppEntries.map(([stage, count]) => `
    <tr><td style="padding: 4px 0; color: #475569;">${OPP_STAGE_LABELS[stage] ?? stage}</td><td style="text-align: right; font-weight: 600;">${count}</td></tr>`).join('')}
    <tr style="border-top: 1px solid #e2e8f0;"><td style="padding: 4px 0; color: #16a34a;">Won this month</td><td style="text-align: right; font-weight: 600;">${data.metrics.wonThisMonth}</td></tr>
    <tr><td style="padding: 4px 0; color: #dc2626;">Lost this month</td><td style="text-align: right; font-weight: 600;">${data.metrics.lostThisMonth}</td></tr>
  </table>`
  }

  // Attention items
  if (attentionCount > 0) {
    html += `
  <h2 style="font-size: 11px; font-weight: 600; color: #dc2626; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Needs Attention</h2>
  <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 13px;">`

    for (const item of data.attentionItems.staleLeads) {
      html += `<div style="padding: 3px 0;">🔴 <strong>${item.cafeName}</strong> — contacted ${item.daysSinceContact} days ago, no reply</div>`
    }
    for (const item of data.attentionItems.staleQuotes) {
      html += `<div style="padding: 3px 0;">🟡 <strong>${item.cafeName}</strong> — quote sent ${item.daysInStage} days ago, no response</div>`
    }
    for (const item of data.attentionItems.samplesAwaitingFeedback) {
      html += `<div style="padding: 3px 0;">🟠 <strong>${item.cafeName}</strong> — samples delivered ${item.deliveredDaysAgo} days ago, no feedback</div>`
    }
    for (const item of data.attentionItems.inTransitSamples) {
      html += `<div style="padding: 3px 0;">📦 <strong>${item.cafeName}</strong> — in transit (${item.trackingNumber})</div>`
    }

    html += `</div>`
  }

  // Low stock
  if (data.metrics.lowStockSkus.length > 0) {
    html += `
  <h2 style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Low Stock</h2>
  <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 13px;">
    ${data.metrics.lowStockSkus.map(s => `<div style="padding: 2px 0;">${s.name}: <strong>${s.quantity}</strong> units</div>`).join('')}
  </div>`
  }

  // Supplier pipeline
  const supplierEntries = Object.entries(data.supplierPipeline)
  if (supplierEntries.length > 0) {
    html += `
  <h2 style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Supplier Pipeline</h2>
  <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 20px;">
    ${supplierEntries.map(([stage, count]) => `
    <tr><td style="padding: 4px 0; color: #475569;">${stage.replace(/_/g, ' ')}</td><td style="text-align: right; font-weight: 600;">${count}</td></tr>`).join('')}
  </table>`
  }

  html += `</div>`
  return html
}

function formatBriefText(data: DailyBriefData): string {
  const date = new Date(data.generatedAt).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Tokyo',
  })

  let text = `*HISA Matcha — Daily Brief*\n${date}\n\n`

  // Metrics
  text += `*Summary*\n`
  text += `Active Leads: ${data.metrics.activeLeads}\n`
  text += `Active Opportunities: ${data.metrics.activeOpportunities}\n`
  text += `Recurring Customers: ${data.metrics.recurringCustomers}\n`
  text += `Won this month: ${data.metrics.wonThisMonth} | Lost: ${data.metrics.lostThisMonth}\n\n`

  // Lead pipeline
  const leadEntries = Object.entries(data.metrics.leadsByStage)
  if (leadEntries.length > 0) {
    text += `*Lead Pipeline*\n`
    for (const [stage, count] of leadEntries) {
      text += `  ${LEAD_STAGE_LABELS[stage] ?? stage}: ${count}\n`
    }
    text += '\n'
  }

  // Opportunity pipeline
  const oppEntries = Object.entries(data.metrics.opportunitiesByStage)
  if (oppEntries.length > 0) {
    text += `*Opportunity Pipeline*\n`
    for (const [stage, count] of oppEntries) {
      text += `  ${OPP_STAGE_LABELS[stage] ?? stage}: ${count}\n`
    }
    text += '\n'
  }

  // Attention items
  const attentionCount =
    data.attentionItems.staleLeads.length +
    data.attentionItems.staleQuotes.length +
    data.attentionItems.samplesAwaitingFeedback.length +
    data.attentionItems.inTransitSamples.length

  if (attentionCount > 0) {
    text += `*⚠️ Needs Attention*\n`
    for (const item of data.attentionItems.staleLeads) {
      text += `  🔴 ${item.cafeName} — contacted ${item.daysSinceContact}d ago, no reply\n`
    }
    for (const item of data.attentionItems.staleQuotes) {
      text += `  🟡 ${item.cafeName} — quote sent ${item.daysInStage}d ago\n`
    }
    for (const item of data.attentionItems.samplesAwaitingFeedback) {
      text += `  🟠 ${item.cafeName} — delivered ${item.deliveredDaysAgo}d ago, no feedback\n`
    }
    for (const item of data.attentionItems.inTransitSamples) {
      text += `  📦 ${item.cafeName} — in transit (${item.trackingNumber})\n`
    }
    text += '\n'
  }

  // Low stock
  if (data.metrics.lowStockSkus.length > 0) {
    text += `*Low Stock*\n`
    for (const s of data.metrics.lowStockSkus) {
      text += `  ${s.name}: ${s.quantity} units\n`
    }
    text += '\n'
  }

  // Supplier pipeline
  const supplierEntries = Object.entries(data.supplierPipeline)
  if (supplierEntries.length > 0) {
    text += `*Supplier Pipeline*\n`
    for (const [stage, count] of supplierEntries) {
      text += `  ${stage.replace(/_/g, ' ')}: ${count}\n`
    }
  }

  return text.trim()
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

async function sendEmail(token: string, briefHtml: string) {
  const gmailUser = process.env.GMAIL_USER
  const gmailPass = process.env.GMAIL_APP_PASSWORD
  const emailTo = process.env.BRIEF_EMAIL_TO
  const baseUrl = process.env.BRIEF_BASE_URL ?? 'http://localhost:3000'

  if (!gmailUser || !gmailPass || !emailTo) {
    console.warn('Gmail not configured — skipping email. Set GMAIL_USER, GMAIL_APP_PASSWORD, BRIEF_EMAIL_TO')
    return
  }

  const briefUrl = `${baseUrl}/daily-brief/${token}`

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: gmailUser, pass: gmailPass },
  })

  const date = new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    timeZone: 'Asia/Tokyo',
  })

  await transporter.sendMail({
    from: gmailUser,
    to: emailTo,
    subject: `HISA Daily Brief — ${date}`,
    html: `
      ${briefHtml}
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
        <a href="${briefUrl}" style="display: inline-block; background: #15803d; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          View Full Brief & Post to Chat →
        </a>
        <p style="font-size: 11px; color: #94a3b8; margin-top: 8px;">
          Add supplier notes and post to Google Chat from the full brief page.
        </p>
      </div>
    `,
  })

  console.log(`Email sent to ${emailTo}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Generating daily brief...')

  const data = await generateBriefData()
  const briefHtml = formatBriefHtml(data)
  const briefText = formatBriefText(data)
  const token = crypto.randomUUID()

  // Insert into daily_briefs
  const { error } = await supabase
    .from('daily_briefs')
    .insert({
      token,
      brief_data: data,
      brief_html: briefHtml,
      brief_text: briefText,
    })

  if (error) {
    console.error('Failed to save brief:', error.message)
    process.exit(1)
  }

  console.log(`Brief saved with token: ${token}`)

  // Send email
  await sendEmail(token, briefHtml)

  const baseUrl = process.env.BRIEF_BASE_URL ?? 'http://localhost:3000'
  console.log(`View brief: ${baseUrl}/daily-brief/${token}`)
  console.log('Done!')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
