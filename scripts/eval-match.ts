// Match eval: npm run eval:match [-- --max-usd 1 --out eval-results/match --only private/]
//
// Runs the production tailor path for real (billed): fit-check keywords -> tailor aimed at
// them -> fact guard -> coverage, and reports before/after, what's still missing and what
// the guard did. Cases: the JSON fixtures with their own jobs, and each private PDF resume
// against the SWE, Web3 support and any private *.job.json jobs (gitignored).
import { loadEnvConfig } from '@next/env'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseResume } from '@/lib/parse-resume'
import { buildTailorInput, callTailorModel, type MasterResume, type TailorJob } from '@/lib/tailor'
import { factGuard } from '@/lib/fact-guard'
import { coverageReport, keywordCoverage, masterKeywordText } from '@/lib/keyword-coverage'
import { tailorOutputText } from '@/lib/resume-text'
import { extractJobKeywords } from '@/lib/skill-check'
import { parsedToMaster } from '@/lib/master-resume'
import { collectUsage } from '@/lib/ai-usage'

loadEnvConfig(process.cwd())

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.join(HERE, 'fixtures')
const argv = process.argv.slice(2)
const arg = (name: string) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? undefined : argv[i + 1]
}
const maxUsd = Number(arg('max-usd') ?? 1)
const only = arg('only') // run only cases whose name contains this
const outDir = path.resolve(arg('out') ?? 'eval-results/match')

let spent = 0
async function billed<T>(fn: () => Promise<T>): Promise<T> {
  const { run, records } = collectUsage(fn)
  try {
    return await run
  } finally {
    spent += records().reduce((s, r) => s + r.costUsd, 0)
  }
}

const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'))

async function main() {
  const cases: { name: string; job: TailorJob; resume: () => Promise<MasterResume> }[] = []
  for (const f of readdirSync(FIXTURES).filter((f) => f.endsWith('.json')).sort()) {
    const fx = readJson(path.join(FIXTURES, f)) as { name: string; job: TailorJob; resume: MasterResume }
    cases.push({ name: fx.name, job: fx.job, resume: async () => fx.resume })
  }
  const privateDir = path.join(FIXTURES, 'private')
  if (existsSync(privateDir)) {
    const jobs = [
      readJson(path.join(FIXTURES, 'jobs', 'greenhouse-swe.json')).job as TailorJob,
      readJson(path.join(FIXTURES, 'jobs', 'dev-support-web3.json')).job as TailorJob,
      ...readdirSync(privateDir).filter((f) => f.endsWith('.job.json')).map((f) => readJson(path.join(privateDir, f)).job as TailorJob),
    ]
    for (const f of readdirSync(privateDir).filter((f) => f.toLowerCase().endsWith('.pdf')).sort()) {
      let parsed: Promise<MasterResume> | null = null
      const resume = () =>
        (parsed ??= billed(() => parseResume({ kind: 'pdf', buffer: readFileSync(path.join(privateDir, f)), filename: f })).then(
          (r) => parsedToMaster(r.resume) as MasterResume
        ))
      for (const job of jobs) cases.push({ name: `private/${f} -> ${job.title}`, job, resume })
    }
  }

  mkdirSync(outDir, { recursive: true })
  const rows: string[] = []
  for (const [i, c] of cases.entries()) {
    if (only && !c.name.includes(only)) continue
    if (spent >= maxUsd) {
      rows.push(`- ${c.name}: skipped (budget)`)
      continue
    }
    try {
      const input = buildTailorInput(await c.resume())
      const keywords = await billed(() => extractJobKeywords(c.job))
      const { output } = await billed(() => callTailorModel(input, c.job, { targetKeywords: keywords }))
      const raw = { ...output, targetKeywords: keywords }
      const { cleaned, warnings } = factGuard(input, raw)
      const coverage = coverageReport(input, cleaned)
      const rawAfter = keywordCoverage(keywords, tailorOutputText(raw, input))
      const lost = coverage.master.present.filter((k) => !rawAfter.present.includes(k))
      rows.push(
        [
          `- ${c.name}: ${coverage.master.score}% -> ${coverage.tailored.score}% (model alone ${rawAfter.score}%)`,
          `  in other words: ${coverage.master.related.join(', ') || '-'} -> ${coverage.tailored.related.join(', ') || '-'}`,
          `  keywords: ${keywords.join(', ')}`,
          `  added: ${coverage.tailored.present.filter((k) => !coverage.master.present.includes(k)).join(', ') || '-'}`,
          `  model lost (guard put back): ${lost.join(', ') || '-'}`,
          `  missing: ${coverage.tailored.missing.join(', ') || '-'}`,
          `  guard: ${warnings.map((w) => `${w.type}:${w.section}`).join(', ') || '-'}`,
        ].join('\n')
      )
      writeFileSync(
        path.join(outDir, `${String(i + 1).padStart(2, '0')}.json`),
        JSON.stringify({ case: c.name, keywords, masterText: masterKeywordText(input), raw, cleaned, warnings, coverage }, null, 2)
      )
    } catch (e) {
      rows.push(`- ${c.name}: ERROR ${String((e as Error)?.message || e).slice(0, 200)}`)
    }
    console.log(`${i + 1}/${cases.length} done, $${spent.toFixed(3)}`)
  }
  const report = `# Match eval\n\nSpent ~$${spent.toFixed(3)}\n\n${rows.join('\n')}\n`
  writeFileSync(path.join(outDir, 'report.md'), report)
  console.log(report)
}

void main()
