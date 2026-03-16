/**
 * Seed sensory profiles for Hisa products and insert competitor products.
 *
 * Usage:
 *   npx tsx scripts/seed-sensory-profiles.ts
 *
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

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
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

// ---------------------------------------------------------------------------
// Hisa product sensory updates
// ---------------------------------------------------------------------------

const hisaUpdates: Record<string, Record<string, unknown>> = {
  'OC-1': {
    tasting_headline: 'Chicory · Green Walnut · Wild Meadow',
    short_description: 'A bold Shizuoka matcha with vivid vegetal character and a dry, expressive finish.',
    long_description: 'A bold Shizuoka matcha with a vivid vegetal profile and structured, dry finish. Notes of chicory and green walnut bring depth and slight bitterness, while wild meadow adds a fresh, untamed green character. Direct and expressive, it holds its presence beautifully in milk and culinary preparations.',
    harvest_season: '2nd and 3rd',
    cultivar: 'Blend (mostly Yabukita, slight blend of Tsuyuhikari and Okumidori)',
    production_region: 'Shizuoka',
    best_for: 'Latte / Culinary',
    photo_folder_url: 'https://drive.google.com/drive/folders/164z4DMt9vtQmdPfNvjP9sb9jFGEgSwL8',
  },
  'SC-3': {
    tasting_headline: 'Toasted Rice · Spring Grass · Raw Cashew',
    short_description: 'A balanced Shizuoka matcha with light smokiness and fresh green depth.',
    long_description: 'A balanced Shizuoka matcha with fresh green brightness and subtle toasted undertones. Light smokiness weaves through notes of spring grass and raw cashew, creating a clean yet gently layered cup. Approachable and versatile.',
    harvest_season: '1st and 2nd',
    cultivar: 'Blend (mostly Yabukita)',
    production_region: 'Shizuoka',
    grind_method: 'Machine Mill',
    roast_level: 'Low',
    texture_description: 'Grainy',
    best_for: 'Latte',
    photo_folder_url: 'https://drive.google.com/drive/folders/164z4DMt9vtQmdPfNvjP9sb9jFGEgSwL8',
  },
  'SC-5': {
    tasting_headline: 'Young Spinach · Cocoa Husk · Wheatgrass',
    short_description: 'A structured first-harvest matcha from Shizuoka with a grounded green profile and gentle cocoa husk bitterness.',
    long_description: 'A structured first-harvest matcha from Shizuoka with a grounded green profile and steady depth. Notes of wheatgrass and young spinach bring fresh vibrancy, while cocoa husk introduces a gentle, refined bitterness that adds structure and clarity to the cup. Balanced yet expressive, it softens beautifully in milk, creating a smooth, composed latte.',
    harvest_season: '1st',
    cultivar: 'Blend (Yabukita)',
    production_region: 'Shizuoka',
    grind_method: 'Machine Mill',
    roast_level: 'Low',
    texture_description: 'Delicately textured',
    best_for: 'Latte',
    photo_folder_url: 'https://drive.google.com/drive/folders/164z4DMt9vtQmdPfNvjP9sb9jFGEgSwL8',
  },
  'SC-6': {
    tasting_headline: 'Roasted Hazelnut · Barley · Sesame',
    short_description: 'A Shizuoka matcha defined by its roasted depth. Nut-forward with toasted grain sweetness and a lingering finish.',
    long_description: 'A Shizuoka matcha defined by its roasted depth and nut-forward character. Layers of roasted hazelnut and sesame unfold over toasted grain sweetness, giving the cup structure and fullness. The finish is long and composed, carrying its grain notes through each sip. A bold, grounded matcha that pairs beautifully with milk.',
    harvest_season: '2nd and 3rd',
    cultivar: 'Blend (Yabukita)',
    production_region: 'Shizuoka',
    best_for: 'Latte',
    photo_folder_url: 'https://drive.google.com/drive/folders/164z4DMt9vtQmdPfNvjP9sb9jFGEgSwL8',
  },
  'SC-7': {
    tasting_headline: 'Sweet Cream · Green Almond · White Chocolate',
    short_description: 'A first-harvest matcha from Kansai with a creamy, sweet profile and soft umami depth. Smooth, round, and quietly refined.',
    long_description: 'A first-harvest matcha from Kansai with a creamy, sweet profile and soft umami depth. Sweet cream and white chocolate create a velvety foundation, while green almond adds subtle freshness and lift. Smooth and rounded, it feels quietly refined and elegantly balanced.',
    harvest_season: '1st',
    cultivar: 'Blend (Yabukita)',
    production_region: 'Kansai',
    best_for: 'Latte / Usucha',
    photo_folder_url: 'https://drive.google.com/drive/folders/164z4DMt9vtQmdPfNvjP9sb9jFGEgSwL8',
  },
}

// ---------------------------------------------------------------------------
// Competitor products (upsert)
// ---------------------------------------------------------------------------

const competitors = [
  {
    product_id: 'COMP-SUZUKI-NUTTY',
    customer_facing_product_name: 'Suzuki Choju Shoten Nutty Matcha',
    supplier_product_name: 'COMP-SUZUKI-NUTTY',
    price_per_kg: 0,
    active: false,
    is_competitor: true,
    competitor_producer: 'Suzuki Choju Shoten',
    competitor_url: 'https://yamachou.net/products/detail/925',
    introduced_by: 'Ikki Matcha',
    production_region: 'Shizuoka',
    roast_level: 'High',
    texture_description: 'Grainy',
    best_for: 'Latte',
    tasting_headline: 'Nutty · Roasted · Bold',
    short_description: 'Strong-fire roasted matcha (強火焙煎). Bold aroma and rich flavor.',
    long_description: 'Nutty matcha with strong-fire roasting (kyōbi baisen). Enhanced roasted, nutty notes with deeper aroma and smoother, mellow profile.',
  },
  {
    product_id: 'COMP-HOSHINO-IKENOSHIRO',
    customer_facing_product_name: 'Hoshino Matcha "Ikenoshiro"',
    supplier_product_name: 'COMP-HOSHINO-IKENOSHIRO',
    price_per_kg: 0,
    active: false,
    is_competitor: true,
    competitor_producer: 'Hoshino (Houkouen)',
    competitor_url: 'https://www.houkouen.co.jp/shopdetail/000000001030/',
    introduced_by: 'Ikki Matcha',
    production_region: 'Yame',
    roast_level: 'High',
    texture_description: 'Very smooth, silky, very fine powder',
    best_for: 'Latte / Usucha / Koicha',
    tasting_headline: 'Roasted Almonds · Nutty · Deep Green',
    short_description: 'Very roasted Yame matcha with vibrant blueish-deep green color and silky texture.',
    long_description: 'Introduced by Ikki Matcha. Noted for its vibrant green, blueish deep green color and extremely smooth, silky texture. Very roasted with strong almond and nutty notes.',
  },
  {
    product_id: 'COMP-CHAJIN-FUURIN',
    customer_facing_product_name: 'Fuurin by Chajin Tea Supply',
    supplier_product_name: 'COMP-CHAJIN-FUURIN',
    price_per_kg: 0,
    active: false,
    is_competitor: true,
    competitor_producer: 'Chajin Tea Supply',
    competitor_url: 'https://chajinteasupply.com/',
    introduced_by: 'Ikki Matcha',
    production_region: 'Kyoto',
    roast_level: 'Medium',
    texture_description: 'Very smooth, silky, very fine powder',
    best_for: 'Latte / Straight Matcha',
    cultivar: 'Samidori / Saemidori blend (suspected)',
    tasting_headline: 'Algae · Fresh Cucumber · Light Roast',
    short_description: 'Algae-like, very fresh matcha with excellent vibrant green color.',
    long_description: 'Algae-like, very fresh character with cucumber notes and light roastedness. Excellent vibrant green color and extremely smooth, silky texture. Possibly Samidori/Saemidori blend.',
  },
  {
    product_id: 'COMP-KOYAMAEN-OGURAYAMA',
    customer_facing_product_name: 'Ogurayama by Yamamasa-Koyamaen',
    supplier_product_name: 'COMP-KOYAMAEN-OGURAYAMA',
    price_per_kg: 0,
    active: false,
    is_competitor: true,
    competitor_producer: 'Yamamasa-Koyamaen',
    competitor_url: 'https://yamamasa-koyamaen.com/products/matcha-ogurayama',
    introduced_by: 'Ikki Matcha',
    grind_method: 'Stone Mill',
    texture_description: 'Smooth, silky',
    best_for: 'Latte / Usucha',
    harvest_season: '1st',
    tasting_headline: 'Balanced · Algae · Clean',
    short_description: 'First harvest, stone milled matcha with balanced algae-like character.',
    long_description: 'First harvest, stone milled matcha with balanced profile and algae-like notes. Vibrant green color with smooth, silky texture.',
  },
]

// ---------------------------------------------------------------------------
// Sensory log entries
// ---------------------------------------------------------------------------

const sensoryLogs = [
  {
    product_id: 'SC-7',
    taster_name: 'Hania',
    tasted_at: '2026-03-09',
    umami_rating: 3,
    bitterness_rating: 1,
    fineness_rating: 5,
    flavor_notes: 'buttery, rich, hazelnut',
  },
  {
    product_id: 'OC-1',
    taster_name: 'Hania',
    tasted_at: '2026-03-09',
    umami_rating: 1,
    bitterness_rating: 2,
    fineness_rating: 1,
    flavor_notes: 'grass, dark chocolate',
  },
  {
    product_id: 'COMP-HOSHINO-IKENOSHIRO',
    taster_name: 'Takuma',
    tasted_at: '2026-02-17',
    flavor_notes: 'Smells like barbeque, different from any other smell ive experienced in the past. I guess this is a smell of the roastedness. Color is a nice vibrant green.',
  },
]

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding sensory profiles...')

  // 1. Update Hisa products
  for (const [productId, data] of Object.entries(hisaUpdates)) {
    const { error } = await supabase
      .from('products')
      .update(data)
      .eq('product_id', productId)
    if (error) {
      console.error(`  ✗ Failed to update ${productId}:`, error.message)
    } else {
      console.log(`  ✓ Updated ${productId}`)
    }
  }

  // 2. Upsert competitor products
  for (const comp of competitors) {
    const { error } = await supabase
      .from('products')
      .upsert(comp, { onConflict: 'product_id' })
    if (error) {
      console.error(`  ✗ Failed to upsert ${comp.product_id}:`, error.message)
    } else {
      console.log(`  ✓ Upserted ${comp.product_id}`)
    }
  }

  // 3. Insert sensory logs
  for (const log of sensoryLogs) {
    const { error } = await supabase
      .from('sensory_logs')
      .insert(log)
    if (error) {
      console.error(`  ✗ Failed to insert sensory log for ${log.product_id}:`, error.message)
    } else {
      console.log(`  ✓ Inserted sensory log for ${log.product_id} by ${log.taster_name}`)
    }
  }

  console.log('Done.')
}

main()
