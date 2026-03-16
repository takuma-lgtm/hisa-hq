import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  // Require authenticated user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const token = body.token as string | undefined
  const supplierNotes = body.supplier_notes as string | undefined

  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json({ error: 'GOOGLE_CHAT_WEBHOOK_URL not configured' }, { status: 500 })
  }

  const service = createServiceClient()

  // Fetch brief by token
  const { data: brief, error: fetchErr } = await service
    .from('daily_briefs')
    .select('brief_id, brief_text, posted_to_chat')
    .eq('token', token)
    .single()

  if (fetchErr || !brief) {
    return NextResponse.json({ error: 'Brief not found' }, { status: 404 })
  }

  // Build the message
  let message = brief.brief_text
  if (supplierNotes?.trim()) {
    message += `\n\n*Supplier Updates*\n${supplierNotes.trim()}`
  }

  // Post to Google Chat
  try {
    const chatRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    })

    if (!chatRes.ok) {
      const text = await chatRes.text()
      return NextResponse.json({ error: `Google Chat error: ${text}` }, { status: 502 })
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to post to Google Chat: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 502 },
    )
  }

  // Update brief record
  await service
    .from('daily_briefs')
    .update({
      posted_to_chat: true,
      posted_at: new Date().toISOString(),
      supplier_notes: supplierNotes?.trim() || null,
    })
    .eq('brief_id', brief.brief_id)

  return NextResponse.json({ success: true, posted_at: new Date().toISOString() })
}
