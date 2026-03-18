// Email utility for sending from sales@hisamatcha.com (Google Workspace via Gmail SMTP)
// Uses same nodemailer pattern as app/api/daily-brief/generate/route.ts

import nodemailer from 'nodemailer'

export function createSalesTransporter() {
  const user = process.env.SALES_GMAIL_USER
  const pass = process.env.SALES_GMAIL_APP_PASSWORD
  if (!user || !pass) throw new Error('SALES_GMAIL_USER and SALES_GMAIL_APP_PASSWORD must be set')

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass },
  })
}

export interface QuoteEmailItem {
  productName: string
  pricePerKg: number
  currency: string
  notes?: string | null
}

export async function sendQuoteEmail({
  to,
  cafeName,
  contactPerson,
  proposalItems,
  notes,
}: {
  to: string
  cafeName: string
  contactPerson: string | null
  proposalItems: QuoteEmailItem[]
  notes: string | null
}): Promise<void> {
  const transporter = createSalesTransporter()
  const from = process.env.SALES_GMAIL_USER!

  const greeting = contactPerson ? `Hi ${contactPerson}` : 'Hi there'

  const itemsHtml = proposalItems
    .map(
      (item) =>
        `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;">${item.productName}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">
            ${item.currency} $${item.pricePerKg.toFixed(2)}/kg
          </td>
        </tr>`,
    )
    .join('')

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1e293b;line-height:1.6;">
  <p style="margin-bottom:16px;">${greeting},</p>
  <p style="margin-bottom:16px;">Thank you for trying our samples! As promised, here are the pricing details for your reference:</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
    <thead>
      <tr style="background:#f8fafc;">
        <th style="padding:8px 10px;text-align:left;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Product</th>
        <th style="padding:8px 10px;text-align:right;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Price per kg</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <p style="font-size:12px;color:#64748b;margin-bottom:16px;">
    Prices are FOB Japan. Shipping, import duties, and taxes are additional and vary by destination.
  </p>
  ${notes ? `<p style="margin-bottom:16px;">${notes}</p>` : ''}
  <p style="margin-bottom:16px;">Please don&rsquo;t hesitate to reach out with any questions &mdash; happy to jump on a call anytime!</p>
  <p style="margin-top:24px;color:#475569;">
    Best,<br/>
    HISA Matcha Team<br/>
    <a href="mailto:sales@hisamatcha.com" style="color:#16a34a;">sales@hisamatcha.com</a>
  </p>
</div>
`

  await transporter.sendMail({
    from: `HISA Matcha <${from}>`,
    to,
    subject: `Matcha Pricing for ${cafeName} — HISA Matcha`,
    html,
  })
}
