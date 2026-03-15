/**
 * Master inventory import — runs all 3 import scripts in order.
 *
 * Usage:
 *   npx tsx scripts/import-inventory-all.ts
 *
 * Order: SKUs → Inventory Log → Inventory Levels
 */

import { execSync } from 'child_process'
import path from 'path'

const scriptsDir = path.resolve(__dirname)

const scripts = [
  { name: 'import-skus.ts', label: 'SKUs' },
  { name: 'import-inventory-log.ts', label: 'Inventory Log' },
  { name: 'import-inventory-levels.ts', label: 'Inventory Levels' },
]

for (const script of scripts) {
  const scriptPath = path.join(scriptsDir, script.name)
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Importing ${script.label}...`)
  console.log(`${'='.repeat(60)}\n`)

  try {
    execSync(`npx tsx "${scriptPath}"`, {
      stdio: 'inherit',
      cwd: path.resolve(scriptsDir, '..'),
    })
  } catch {
    console.error(`\nFailed to import ${script.label}. Aborting.`)
    process.exit(1)
  }
}

console.log(`\n${'='.repeat(60)}`)
console.log('All imports completed successfully!')
console.log(`${'='.repeat(60)}`)
