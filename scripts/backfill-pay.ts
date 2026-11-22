// Re-reads every open job's pay label from its text with the current parser (src/lib/pay.ts).
// Dry run by default: prints what would change. Writes only with --apply (prod data: Jake's call).
//   npx tsx --tsconfig tsconfig.json scripts/backfill-pay.ts [--apply]
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { PrismaClient } from '@prisma/client'
import { payFromText } from '@/lib/pay'

const apply = process.argv.includes('--apply')
const db = new PrismaClient()

async function main() {
  const rows = await db.job.findMany({ where: { closedAt: null, description: { not: '' } }, select: { id: true, payLabel: true, description: true } })
  const changes = rows.flatMap((r) => {
    const label = payFromText(r.description)?.label ?? null
    return label !== r.payLabel ? [{ id: r.id, from: r.payLabel, to: label }] : []
  })
  console.log(`${rows.length} open jobs, ${changes.length} labels would change${apply ? '' : ' (dry run; add --apply to write)'}`)
  for (const c of changes.slice(0, 15)) console.log(`  ${c.from} -> ${c.to}`)
  if (!apply) return
  let done = 0
  for (const c of changes) {
    await db.job.update({ where: { id: c.id }, data: { payLabel: c.to } })
    done++
  }
  console.log(`Updated ${done}.`)
}
main().finally(() => db.$disconnect())
