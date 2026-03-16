/**
 * One-time supplier import from Google Sheet data.
 *
 * Usage:
 *   npx tsx scripts/seed-suppliers.ts
 *
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
import { createClient } from '@supabase/supabase-js'

// Load .env.local manually
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

// Stage mapping: number prefix → enum value
const STAGE_MAP: Record<string, string> = {
  '1': 'in_communication',
  '2': 'visit_scheduled',
  '3': 'visited',
  '4': 'inquiry_sent',
  '6': 'met_at_event',
  '7': 'not_started',
  '8': 'ng',
  '9': 'deal_established',
}

// Business type mapping
const BUSINESS_TYPE_MAP: Record<string, string> = {
  '製茶問屋': 'tea_wholesaler',
  '農園': 'farm',
  'ブローカー': 'broker',
  'その他': 'other',
}

// Sample status mapping
const SAMPLE_STATUS_MAP: Record<string, string> = {
  'Waiting for Samples': 'waiting',
  'Samples Received': 'received',
  'Evaluated': 'evaluated',
}

// CSV data from Google Sheet (仕入れ先候補リスト) — exported 2026-03-14
const CSV_DATA = `企業名,ステータス,サンプル状況,都道府県,業態区分,Memo,アクションメモ (日付入れる),Date Updated,入り口
丸八製茶場,1 - やりとり中,,石川,製茶問屋,ほうじ茶。2/20に問い合わせ。,2/20に問い合わせ。本社から連絡が来る,2/20/2026,
今吉製茶,2 - 訪問予定,,鹿児島,製茶問屋,"090-8227-5531\n3/4にご挨拶予定。",,2/27/2026,
井ケ田製茶北郷茶園,2 - 訪問予定,,宮崎,農園,ほうじ茶。抹茶は去年からスタート,宮崎の問屋。対面調整中。,2/27/2026,
南山園,3 - 訪問済,Waiting for Samples,愛知,製茶問屋,サンプル発送してもらう,"2/13に問い合わせフォーム連絡\n2/20に再度連絡、営業担当に繋いでくれるとのこと",2/27/2026,問い合わせフォーム
赤堀製茶,3 - 訪問済,Waiting for Samples,愛知,農園,3kg可能。LINE送ったが返信なし。,"2/4に架電した。資料を2/4に送ったので、2/6にフォローアップ連絡する。\n2/6にフォローアップの連絡ずみ。反応は良さそうだった。また来週電話をして、飛び込み営業でも良いので挨拶の予定は入れれるかもしれない。\n2/12に電話。2/25に会う約束ができた。",2/27/2026,赤堀さん
茶遊堂,3 - 訪問済,Waiting for Samples,京都,その他,抹茶スイーツ会社。2/28サンプル到着予定。,,2/27/2026,
舞妓の茶本舗,3 - 訪問済,Waiting for Samples,京都,製茶問屋,店舗でご挨拶済。2/28にサンプル到着予定。,,2/27/2026,幕張スーパートレードショー
お茶のながや,3 - 訪問済,,愛知,農園,3月にサンプルを注文する,,2/27/2026,
ヤマチョウ鈴木長十,3 - 訪問済,Waiting for Samples,静岡,製茶問屋,2/26にサンプル受け取り済。評価必要,,2/27/2026,
西村幸太郎商店,4 - 問い合わせフォーム連絡済,,京都,製茶問屋,工程などがものすごくしっかりしている,2/24に電話で連絡、今週は監査で難しいとのこと。多分断り？,2/27/2026,問い合わせフォーム
カネ松製茶株式会社,6 - イベントでご挨拶,Waiting for Samples,静岡,製茶問屋,メールやりとり済。サンプル送ってもらう。,,2/27/2026,幕張スーパートレードショー
茶縁,7 - 未着手,,京都,,,,,直接電話
菊永茶生産組合,7 - 未着手,,鹿児島,製茶問屋,,,,
芳香園,7 - 未着手,,京都,製茶問屋,,,,直接電話
カネ七畠山製茶,7 - 未着手,,京都,,,,,直接電話
辻利園,7 - 未着手,,京都,,,,,直接電話
角與商店,7 - 未着手,,京都,,,,,直接電話
清水一芳園,7 - 未着手,,京都,,,,,直接電話
藤本商店,7 - 未着手,,京都,,,,,直接電話
堀田勝太郎商店,7 - 未着手,,京都,,,,,直接電話
孫右ヱ門,7 - 未着手,,京都,,,,,直接電話
桑原善助商店,7 - 未着手,,京都,,,,,直接電話
木長園,7 - 未着手,,京都,,,,,直接電話
碧翠園,7 - 未着手,,京都,,,,,直接電話
播磨園製茶,7 - 未着手,,京都,,,,,直接電話
尚美園製茶場,7 - 未着手,,京都,,,,,直接電話
山本茶園,7 - 未着手,,京都,,,,,直接電話
西村番茶屋本店,7 - 未着手,,京都,,,,,直接電話
泉香園,7 - 未着手,,京都,,,,,直接電話
又兵衛,7 - 未着手,,京都,ブローカー,,,,
Sonogi Tea,7 - 未着手,,,,,2/16に問い合わせフォームで連絡する,,
大橋製茶,7 - 未着手,,鹿児島,製茶問屋,,2/9に架電する,,
葉桐,7 - 未着手,,,,,2/9に架電する,,食品輸出エキスポ
利招園茶舗,7 - 未着手,,京都,,Kozy Cafe に 1/17に紹介された。,2/9に架電する,,Kozy Cafe Intro
堀井7名園,7 - 未着手,,,,Jianrui follows this,,,
矢野製茶場,7 - 未着手,,京都,,,宇治の抹茶。直接農家。,,
西垂水,8 - NG,,鹿児島,農園,すでに手一杯とのこと。,,,柴さん紹介
たけ茶園,8 - NG,,鹿児島,製茶問屋,柴さんに断られた。,,,柴さん紹介
チクメイ堂,8 - NG,,奈良,その他,"茶センの老舗。Welcome package につけれる。\n2/20に問い合わせ。新規はなしとのこと。",,,
ヘンタ製茶,8 - NG,,鹿児島,製茶問屋,鹿児島で賞をものすごく取っている,"2/16に問い合わせフォームで連絡ずみ。\n2/23に追い連絡する",,問い合わせフォーム
西製茶,8 - NG,,鹿児島,製茶問屋,,2/16に問い合わせフォームで連絡ずみ。電話で追い連絡必要。,,問い合わせフォーム
小林漆陶,8 - NG,,岐阜,その他,茶筅を持っている,2/24に電話する,,直接電話
葵製茶,8 - NG,,愛知,製茶問屋,"アメリカに子会社がある。\n今は新規は受け付けていない。",,,
末重製茶,8 - NG,,鹿児島,製茶問屋,抹茶は取り扱っていない,,,
近藤製茶,8 - NG,,愛知,製茶問屋,2/25に飛び込み営業？,,,
宝明堂,8 - NG,,愛知,製茶問屋,新規無理。,,,
あいや,8 - NG,,愛知,製茶問屋,新規無理。,,,
大井川茶園,9 - 取引成立,,静岡,農園,,,,営業担当の橋本さん`

async function main() {
  console.log('Parsing supplier data...')

  const parsed = Papa.parse<Record<string, string>>(CSV_DATA, {
    header: true,
    skipEmptyLines: true,
  })

  console.log(`Found ${parsed.data.length} rows`)

  // Check existing suppliers for dedup
  const { data: existing } = await supabase
    .from('suppliers')
    .select('supplier_id, supplier_name')

  const existingMap = new Map(
    (existing ?? []).map((s: { supplier_id: string; supplier_name: string }) => [s.supplier_name, s.supplier_id])
  )

  let created = 0
  let updated = 0
  let skipped = 0

  for (const row of parsed.data) {
    const supplierName = row['企業名']?.trim()
    if (!supplierName) { skipped++; continue }

    // Map stage
    const stageRaw = row['ステータス']?.trim() ?? ''
    const stageNum = stageRaw.match(/^(\d)/)?.[1]
    const stage = stageNum ? STAGE_MAP[stageNum] : 'not_started'

    // Map business type
    const btRaw = row['業態区分']?.trim() ?? ''
    const businessType = BUSINESS_TYPE_MAP[btRaw] ?? null

    // Map sample status
    const ssRaw = row['サンプル状況']?.trim() ?? ''
    const sampleStatus = SAMPLE_STATUS_MAP[ssRaw] ?? 'none'

    // Map date
    const dateRaw = row['Date Updated']?.trim() ?? ''
    let dateUpdated: string | null = null
    if (dateRaw) {
      const d = new Date(dateRaw)
      if (!isNaN(d.getTime())) {
        dateUpdated = d.toISOString().split('T')[0]
      }
    }

    const record: Record<string, unknown> = {
      supplier_name: supplierName,
      stage: stage ?? 'not_started',
      sample_status: sampleStatus,
      prefecture: row['都道府県']?.trim() || null,
      business_type: businessType,
      memo: row['Memo']?.trim() || null,
      action_memo: row['アクションメモ (日付入れる)']?.trim() || null,
      date_updated: dateUpdated,
      source: row['入り口']?.trim() || null,
    }

    const existingId = existingMap.get(supplierName)

    if (existingId) {
      const { error } = await supabase
        .from('suppliers')
        .update(record)
        .eq('supplier_id', existingId)
      if (!error) {
        updated++
        console.log(`  Updated: ${supplierName}`)
      } else {
        console.error(`  Error updating ${supplierName}:`, error.message)
        skipped++
      }
    } else {
      const { error } = await supabase
        .from('suppliers')
        .insert(record)
      if (!error) {
        created++
        console.log(`  Created: ${supplierName}`)
      } else {
        console.error(`  Error creating ${supplierName}:`, error.message)
        skipped++
      }
    }
  }

  console.log('\n--- Results ---')
  console.log(`Created: ${created}`)
  console.log(`Updated: ${updated}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Total:   ${parsed.data.length}`)
}

main().catch(console.error)
