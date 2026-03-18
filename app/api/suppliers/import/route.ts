import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import Papa from 'papaparse'

// Map numbered stages from the Google Sheet to enum values
const STAGE_MAP: Record<string, string> = {
  '7': 'not_started',
  '1': 'in_communication',
  '2': 'visit_scheduled',
  '3': 'visited',
  '4': 'inquiry_sent',
  '6': 'met_at_event',
  '8': 'ng',
  '9': 'deal_established',
}

// Map Japanese business types to enum values
const BUSINESS_TYPE_MAP: Record<string, string> = {
  '製茶問屋': 'tea_wholesaler',
  '農園': 'farm',
  'ブローカー': 'broker',
  'その他': 'other',
}

// Map sample status strings to enum values
const SAMPLE_STATUS_MAP: Record<string, string> = {
  'Waiting for Samples': 'waiting',
  'Samples Received': 'received',
  'Evaluated': 'evaluated',
}

// Map Japanese/English column headers to DB field names
const COLUMN_MAP: Record<string, string> = {
  '企業名': 'supplier_name',
  'ステータス': 'stage',
  'サンプル状況': 'sample_status',
  '都道府県': 'prefecture',
  '業態区分': 'business_type',
  'Memo': 'memo',
  'アクションメモ': 'action_memo',
  'Date Updated': 'date_updated',
  '入り口': 'source',
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const body = await request.json()
  if (!body.csv) {
    return NextResponse.json({ error: 'csv field is required' }, { status: 400 })
  }

  const parsed = Papa.parse<Record<string, string>>(body.csv, {
    header: true,
    skipEmptyLines: true,
  })

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    return NextResponse.json({ error: 'Failed to parse CSV', details: parsed.errors }, { status: 400 })
  }

  const service = createServiceClient()

  // Fetch existing suppliers for dedup
  const { data: existing } = await service
    .from('suppliers')
    .select('supplier_id, supplier_name')

  const existingMap = new Map(
    (existing ?? []).map((s) => [s.supplier_name, s.supplier_id])
  )

  let created = 0
  let updated = 0
  let skipped = 0

  for (const row of parsed.data) {
    // Map columns
    const mapped: Record<string, unknown> = {}
    for (const [csvCol, value] of Object.entries(row)) {
      const dbField = COLUMN_MAP[csvCol.trim()]
      if (dbField && value?.trim()) {
        mapped[dbField] = value.trim()
      }
    }

    if (!mapped.supplier_name) {
      skipped++
      continue
    }

    // Transform stage (extract number from "7 - 未着手" format or just "7")
    if (mapped.stage) {
      const stageStr = String(mapped.stage)
      const stageNum = stageStr.match(/^(\d)/)?.[1]
      if (stageNum && STAGE_MAP[stageNum]) {
        mapped.stage = STAGE_MAP[stageNum]
      } else {
        delete mapped.stage
      }
    }

    // Transform business type
    if (mapped.business_type) {
      const bt = BUSINESS_TYPE_MAP[String(mapped.business_type)]
      if (bt) {
        mapped.business_type = bt
      } else {
        delete mapped.business_type
      }
    }

    // Transform sample status
    if (mapped.sample_status) {
      const ss = SAMPLE_STATUS_MAP[String(mapped.sample_status)]
      mapped.sample_status = ss ?? 'none'
    }

    // Transform date_updated
    if (mapped.date_updated) {
      const d = new Date(String(mapped.date_updated))
      if (isNaN(d.getTime())) {
        delete mapped.date_updated
      } else {
        mapped.date_updated = d.toISOString().split('T')[0]
      }
    }

    const supplierName = String(mapped.supplier_name)
    const existingId = existingMap.get(supplierName)

    if (existingId) {
      // Update existing
      const { error } = await service
        .from('suppliers')
        .update(mapped)
        .eq('supplier_id', existingId)
      if (!error) updated++
      else skipped++
    } else {
      // Insert new
      const { data: newSupplier, error } = await service
        .from('suppliers')
        .insert(mapped as Record<string, unknown> & { supplier_name: string })
        .select('supplier_id, supplier_name')
        .single()
      if (!error && newSupplier) {
        created++
        existingMap.set(newSupplier.supplier_name, newSupplier.supplier_id)
      } else {
        skipped++
      }
    }
  }

  return NextResponse.json({
    success: true,
    total: parsed.data.length,
    created,
    updated,
    skipped,
  })
}
