// One-off: pre-write close-the-gap plans for common skills. Usage: seed-gaps <skills.json> <out.json>
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { readFileSync, writeFileSync } from 'node:fs'
import { generateGapPlans, type GapPlan } from '@/lib/gap-plan'
import { collectUsage } from '@/lib/ai-usage'

const CAP_USD = 0.95

async function main() {
  const skills: string[] = JSON.parse(readFileSync(process.argv[2], 'utf8'))
  const batches: string[][] = []
  for (let i = 0; i < skills.length; i += 8) batches.push(skills.slice(i, i + 8))
  const plans: GapPlan[] = []
  let spent = 0
  for (let i = 0; i < batches.length; i += 4) {
    if (spent >= CAP_USD) break
    const group = batches.slice(i, i + 4)
    const results = await Promise.all(
      group.map(async (b) => {
        const { run, usage } = collectUsage(() => generateGapPlans(b))
        try {
          const p = await run
          return { p, cost: usage().costUsd ?? 0 }
        } catch (e) {
          console.error('batch failed', b[0], (e as Error).message)
          return { p: [] as GapPlan[], cost: usage().costUsd ?? 0 }
        }
      })
    )
    for (const r of results) {
      plans.push(...r.p)
      spent += r.cost
    }
    console.log(`batches ${Math.min(i + 4, batches.length)}/${batches.length} plans ${plans.length} spent $${spent.toFixed(3)}`)
  }
  writeFileSync(process.argv[3], JSON.stringify(plans, null, 1))
  console.log(`done: ${plans.length} plans, $${spent.toFixed(3)}`)
}
main()
