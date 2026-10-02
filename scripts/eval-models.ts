// Model eval: npm run eval:models [-- --models a,b --max-usd 3 --out eval-results]
//
// Sends the same fixtures to each model through the real pipeline (parse -> tailor ->
// fact guard -> cover letter) and reports cost, speed and quality, so routing (AI_* env)
// is picked with data.
//
//   --models   comma-separated provider:model list. Default: Opus 5.5, Sonnet 5.5, gpt-4o,
//              gpt-5.4-mini, openrouter moonshotai/kimi-k2.6
//   --max-usd  stop starting new work once estimated spend passes this (default 3)
//   --out      output directory (default eval-results/, gitignored: it quotes resumes)
//
// Fixtures: the 3 JSON resumes in scripts/fixtures/ (each with its own job), the
// enhancv-swe.txt resume (parsed first) against jobs/greenhouse-swe.json, the restaurant
// resume against jobs/ops-coordinator-nontech.json, and any PDFs in
// scripts/fixtures/private/ (gitignored) against the SWE job.
//
// Providers whose key is missing are skipped and noted in the report. Makes real,
// billed API calls. Costs are estimates from src/lib/ai/models.ts.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseResume, type ParseInput } from '@/lib/parse-resume'
import { applyTailorOutput, buildTailorInput, callTailorModel, type MasterResume, type TailorJob } from '@/lib/tailor'
import { factGuard } from '@/lib/fact-guard'
import { coverageReport } from '@/lib/keyword-coverage'
import { BANNED_PHRASES, bannedPhrasesIn, generateCoverLetter } from '@/lib/cover-letter'
import { parsedToMaster } from '@/lib/master-resume'
import { recruiterText } from '@/lib/recruiter-text'
import { collectUsage, type UsageRecord } from '@/lib/ai-usage'
import { modelLabel } from '@/lib/ai/models'
import { formatRoute, parseRoute, providerConfigured, PROVIDER_KEY_ENV, type ModelRoute } from '@/lib/ai/routing'
import { netRevenueUsd } from '@/lib/ai-cap-rules'
import { PASS_PRICE_USD, PRO_MONTHLY_PRICE_USD } from '@/lib/plans'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.join(HERE, 'fixtures')

export const DEFAULT_MODELS = [
  'anthropic:claude-opus-5-5',
  'anthropic:claude-sonnet-5-5',
  'openai:gpt-4o',
  'openai:gpt-5.4-mini',
  'openrouter:moonshotai/kimi-k2.6',
]

// ---------- args ----------

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2)
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`))
  if (i === -1) return undefined
  const a = argv[i]
  return a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[i + 1]
}

const models: ModelRoute[] = (arg('models')?.split(',') ?? DEFAULT_MODELS).map((m) => {
  const r = parseRoute(m.trim())
  if (!r) throw new Error(`Bad --models entry "${m}". Use provider:model, e.g. anthropic:claude-sonnet-5-5`)
  return r
})
const maxUsd = Number(arg('max-usd') ?? 3)
const outDir = path.resolve(arg('out') ?? 'eval-results')

// ---------- fixtures ----------

interface Case {
  name: string
  job: TailorJob
  resume?: MasterResume // structured fixture
  parse?: ParseInput // resume that goes through parse first
}

const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'))

function loadCases(): Case[] {
  const cases: Case[] = []
  const jsonFixtures = readdirSync(FIXTURES)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => readJson(path.join(FIXTURES, f)) as { name: string; job: TailorJob; resume: MasterResume })
  for (const f of jsonFixtures) cases.push({ name: f.name, job: f.job, resume: f.resume })

  const swe = readJson(path.join(FIXTURES, 'jobs', 'greenhouse-swe.json')) as { name: string; job: TailorJob }
  const ops = readJson(path.join(FIXTURES, 'jobs', 'ops-coordinator-nontech.json')) as { name: string; job: TailorJob }

  cases.push({ name: 'enhancv-swe.txt (parsed) -> Greenhouse SWE', job: swe.job, parse: { kind: 'text', text: readFileSync(path.join(FIXTURES, 'enhancv-swe.txt'), 'utf8') } })
  const restaurant = jsonFixtures.find((f) => /restaurant/i.test(f.name))
  if (restaurant) cases.push({ name: `${restaurant.name.split('->')[0].trim()} -> ${ops.job.title} (non-tech)`, job: ops.job, resume: restaurant.resume })

  const privateDir = path.join(FIXTURES, 'private')
  if (existsSync(privateDir)) {
    for (const f of readdirSync(privateDir).filter((f) => f.toLowerCase().endsWith('.pdf')).sort()) {
      cases.push({ name: `private/${f} (parsed) -> Greenhouse SWE`, job: swe.job, parse: { kind: 'pdf', buffer: readFileSync(path.join(privateDir, f)), filename: f } })
    }
  }
  return cases
}

// ---------- measuring ----------

interface StepResult {
  ok: boolean
  error?: string
  ms: number
  costUsd: number
  tokensIn: number
  cachedIn: number
  tokensOut: number
  calls: number
  firstTryValid: boolean | null // null when no call was made
}

interface Row {
  model: string
  case: string
  parse?: StepResult & { needsReview?: number }
  tailor?: StepResult & { warnings?: number; coverageBefore?: number; coverageAfter?: number; summary?: string; bullets?: string[] }
  cover?: StepResult & { bannedHits?: number; regenerated?: boolean; warnings?: number; text?: string }
}

let spent = 0

async function measure<T>(fn: () => Promise<T>): Promise<{ value?: T; step: StepResult }> {
  const start = Date.now()
  const { run, records } = collectUsage(fn)
  let value: T | undefined
  let error: string | undefined
  try {
    value = await run
  } catch (e) {
    error = String((e as Error)?.message || e).slice(0, 200)
  }
  const rec: UsageRecord[] = records()
  const costUsd = rec.reduce((s, r) => s + r.costUsd, 0)
  spent += costUsd
  return {
    value,
    step: {
      ok: !error,
      error,
      ms: Date.now() - start,
      costUsd,
      tokensIn: rec.reduce((s, r) => s + r.tokensIn, 0),
      cachedIn: rec.reduce((s, r) => s + r.cachedIn, 0),
      tokensOut: rec.reduce((s, r) => s + r.tokensOut, 0),
      calls: rec.length,
      firstTryValid: rec.length ? rec[0].ok !== false : null,
    },
  }
}

/** Banned phrases the model wrote before the guard: from the retry feedback and the guard's removals. */
function bannedHits(warnings: { type: string; message: string }[]): number {
  let hits = 0
  for (const w of warnings) {
    if (w.type === 'regenerated') {
      const m = w.message.match(/Remove these banned phrases: ([^.]*)\./)
      if (m) hits += (m[1].match(/"[^"]+"/g) ?? []).length
    }
    if (w.type === 'banned_phrase') hits += 1
  }
  return hits
}

async function runCase(route: ModelRoute, c: Case): Promise<Row> {
  const row: Row = { model: formatRoute(route), case: c.name }
  const opts = { route }

  let master = c.resume
  if (c.parse) {
    const { value, step } = await measure(() => parseResume(c.parse!, opts))
    row.parse = { ...step, needsReview: value?.needsReview.length }
    if (!value) return row
    master = parsedToMaster(value.resume) as MasterResume
  }
  if (!master) return row

  const input = buildTailorInput(master)
  const tailored = await measure(() => callTailorModel(input, c.job, opts))
  if (!tailored.value) {
    row.tailor = tailored.step
    return row
  }
  const { cleaned, warnings } = factGuard(input, tailored.value.output)
  const coverage = coverageReport(input, cleaned)
  row.tailor = {
    ...tailored.step,
    warnings: warnings.length,
    coverageBefore: coverage.master.score,
    coverageAfter: coverage.tailored.score,
    summary: cleaned.summary,
    bullets: (cleaned.roles[0]?.bullets ?? []).slice(0, 3).map((b) => b.text),
  }

  const tailoredResume = applyTailorOutput(master, input, cleaned)
  const candidateName = [
    (master.contactInfo as Record<string, string> | undefined)?.fullName,
    [(master.contactInfo as Record<string, string> | undefined)?.firstName, (master.contactInfo as Record<string, string> | undefined)?.lastName].filter(Boolean).join(' '),
  ].find((n) => n && n.trim()) || 'Candidate'
  const cover = await measure(() =>
    generateCoverLetter(
      { master: input, tailoredText: recruiterText(tailoredResume), candidateName, job: c.job, tone: 'professional', extraFacts: [] },
      opts
    )
  )
  row.cover = {
    ...cover.step,
    bannedHits: cover.value ? bannedHits(cover.value.warnings) + bannedPhrasesIn(cover.value.text).length : undefined,
    regenerated: cover.value?.warnings.some((w) => w.type === 'regenerated'),
    warnings: cover.value?.warnings.filter((w) => w.type !== 'regenerated').length,
    text: cover.value?.text,
  }
  return row
}

// ---------- report ----------

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(Math.abs(n) < 0.1 ? 4 : 2)}`
const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const fmt = (n: number, f: (n: number) => string) => (Number.isFinite(n) ? f(n) : 'n/a')

interface Summary {
  model: string
  label: string
  jobs: number
  avgJobCost: number // tailor + cover letter
  avgParseCost: number
  avgJobMs: number
  avgWarnings: number
  avgCoverageGain: number
  bannedHits: number
  firstTryInvalid: number
  failures: number
}

function summarize(model: string, rows: Row[]): Summary {
  const mine = rows.filter((r) => r.model === model)
  const fullJobs = mine.filter((r) => r.tailor?.ok && r.cover?.ok)
  const steps = mine.flatMap((r) => [r.parse, r.tailor, r.cover]).filter((s): s is StepResult => !!s)
  return {
    model,
    label: modelLabel(parseRoute(model)!.model),
    jobs: fullJobs.length,
    avgJobCost: avg(fullJobs.map((r) => r.tailor!.costUsd + r.cover!.costUsd)),
    avgParseCost: avg(mine.filter((r) => r.parse?.ok).map((r) => r.parse!.costUsd)),
    avgJobMs: avg(fullJobs.map((r) => r.tailor!.ms + r.cover!.ms)),
    avgWarnings: avg(fullJobs.map((r) => r.tailor!.warnings ?? 0)),
    avgCoverageGain: avg(fullJobs.map((r) => (r.tailor!.coverageAfter ?? 0) - (r.tailor!.coverageBefore ?? 0))),
    bannedHits: fullJobs.reduce((s, r) => s + (r.cover!.bannedHits ?? 0), 0),
    firstTryInvalid: steps.filter((s) => s.firstTryValid === false).length,
    failures: steps.filter((s) => !s.ok).length,
  }
}

// Monthly revenue a user brings in, net of Stripe. The pass is one payment for 3 months.
const PRO_NET = netRevenueUsd(PRO_MONTHLY_PRICE_USD)
const PASS_NET_PER_MONTH = netRevenueUsd(PASS_PRICE_USD) / 3

function projection(s: Summary): string[] {
  if (!Number.isFinite(s.avgJobCost)) return []
  return [20, 60, 150].map((n) => {
    const cost = n * s.avgJobCost + (Number.isFinite(s.avgParseCost) ? s.avgParseCost : 0)
    const pro = PRO_NET - cost
    const pass = PASS_NET_PER_MONTH - cost
    return `| ${s.label} | ${n} | ${money(cost)} | ${money(pro)} (${Math.round((cost / PRO_NET) * 100)}% of net) | ${money(pass)} (${Math.round((cost / PASS_NET_PER_MONTH) * 100)}% of net) |`
  })
}

function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function writeReport(rows: Row[], skipped: string[], stoppedEarly: boolean, cases: Case[]) {
  mkdirSync(outDir, { recursive: true })
  const date = new Date().toISOString().slice(0, 10)
  const ran = [...new Set(rows.map((r) => r.model))]
  const summaries = ran.map((m) => summarize(m, rows))

  const md: string[] = [
    `# Model eval ${date}`,
    '',
    `Fixtures: ${cases.length} (${cases.map((c) => c.name).join('; ')}).`,
    `Estimated spend: ${money(spent)} of the ${money(maxUsd)} cap${stoppedEarly ? ' (stopped early: cap reached)' : ''}.`,
    ...(skipped.length ? ['', `Skipped (no API key): ${skipped.join(', ')}.`] : []),
    '',
    'A "full job" is one tailored resume plus one cover letter. Costs are estimates from src/lib/ai/models.ts.',
    '',
    '## Summary',
    '',
    '| Model | Full jobs | Avg cost / full job | Avg parse | Avg latency / full job | Fact-guard warnings / tailor | Keyword coverage gain | Banned phrases (pre-guard) | Invalid first try | Failures |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...summaries.map(
      (s) =>
        `| ${s.label} (\`${s.model}\`) | ${s.jobs} | ${fmt(s.avgJobCost, money)} | ${fmt(s.avgParseCost, money)} | ${fmt(s.avgJobMs, secs)} | ${fmt(s.avgWarnings, (n) => n.toFixed(1))} | ${fmt(s.avgCoverageGain, (n) => `+${n.toFixed(0)} pts`)} | ${s.bannedHits} | ${s.firstTryInvalid} | ${s.failures} |`
    ),
    '',
    '## Projected monthly AI cost vs net revenue',
    '',
    `Net revenue after Stripe (2.9% + $0.30): Pro ${money(PRO_NET)}/month, Job Hunt Pass ${money(netRevenueUsd(PASS_PRICE_USD))} for 3 months (${money(PASS_NET_PER_MONTH)}/month). Cost = jobs x avg full job + one parse. Margin before the AI cap kicks in (the cap pauses AI at 70% of net).`,
    '',
    '| Model | Full jobs / month | AI cost | Pro margin | Pass margin (per month) |',
    '|---|---|---|---|---|',
    ...summaries.flatMap(projection),
    '',
    '## Per fixture',
    '',
    '| Model | Fixture | Parse | Tailor | Warnings | Coverage | Cover letter | Banned | Errors |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => {
      const step = (s?: StepResult) => (s ? `${s.ok ? '' : 'FAILED '}${money(s.costUsd)}, ${secs(s.ms)}${s.firstTryValid === false ? ', repaired' : ''}` : '-')
      const errors = [r.parse, r.tailor, r.cover].map((s) => s?.error).filter(Boolean).join('; ')
      return `| ${modelLabel(parseRoute(r.model)!.model)} | ${r.case} | ${step(r.parse)} | ${step(r.tailor)} | ${r.tailor?.warnings ?? '-'} | ${r.tailor?.coverageBefore ?? '-'}% -> ${r.tailor?.coverageAfter ?? '-'}% | ${step(r.cover)} | ${r.cover?.bannedHits ?? '-'} | ${errors || ''} |`
    }),
    '',
    '## Writing samples',
    '',
  ]

  for (const c of cases) {
    const mine = rows.filter((r) => r.case === c.name && r.tailor?.ok)
    if (!mine.length) continue
    md.push(`### ${c.name}`, '', `Target: ${c.job.title} at ${c.job.company}`, '')
    for (const r of mine) {
      md.push(`**${modelLabel(parseRoute(r.model)!.model)}**`, '', `> ${r.tailor!.summary ?? ''}`, '')
      for (const b of r.tailor!.bullets ?? []) md.push(`- ${b}`)
      const opening = r.cover?.text?.split('\n\n').slice(1, 2).join('')
      if (opening) md.push('', `Cover letter, first paragraph: _${opening}_`)
      md.push('')
    }
  }
  md.push('## Notes', '', `Banned phrase list: ${BANNED_PHRASES.length} phrases (src/lib/cover-letter.ts). "Pre-guard" counts what the model wrote before the regenerate/guard removed it.`)

  const csvHeader = ['model', 'fixture', 'step', 'ok', 'ms', 'costUsd', 'tokensIn', 'cachedIn', 'tokensOut', 'calls', 'firstTryValid', 'warnings', 'coverageBefore', 'coverageAfter', 'bannedHits', 'error']
  const csv = [csvHeader.join(',')]
  for (const r of rows) {
    for (const [name, s] of [
      ['parse', r.parse],
      ['tailor', r.tailor],
      ['cover', r.cover],
    ] as const) {
      if (!s) continue
      const x = s as StepResult & Record<string, unknown>
      csv.push(
        [r.model, r.case, name, s.ok, s.ms, s.costUsd.toFixed(6), s.tokensIn, s.cachedIn, s.tokensOut, s.calls, s.firstTryValid, x.warnings ?? x.needsReview, x.coverageBefore, x.coverageAfter, x.bannedHits, s.error]
          .map(csvCell)
          .join(',')
      )
    }
  }

  const base = path.join(outDir, date)
  writeFileSync(`${base}.md`, md.join('\n') + '\n')
  writeFileSync(`${base}.csv`, csv.join('\n') + '\n')
  return { md: `${base}.md`, csv: `${base}.csv` }
}

// ---------- main ----------

async function main() {
  const cases = loadCases()
  const skipped: string[] = []
  const runnable = models.filter((m) => {
    if (providerConfigured(m.provider)) return true
    skipped.push(`${formatRoute(m)} (${PROVIDER_KEY_ENV[m.provider]} not set)`)
    return false
  })
  console.log(`Model eval: ${runnable.length} model(s) x ${cases.length} fixture(s), cap ${money(maxUsd)}`)
  if (skipped.length) console.log(`Skipping: ${skipped.join(', ')}`)

  const rows: Row[] = []
  let stoppedEarly = false
  outer: for (const c of cases) {
    for (const m of runnable) {
      if (spent >= maxUsd) {
        stoppedEarly = true
        console.log(`Stopping: estimated spend ${money(spent)} reached the ${money(maxUsd)} cap.`)
        break outer
      }
      process.stdout.write(`  ${formatRoute(m)} | ${c.name} ... `)
      const row = await runCase(m, c)
      rows.push(row)
      const errs = [row.parse, row.tailor, row.cover].filter((s) => s && !s.ok).length
      console.log(`${errs ? `${errs} failed, ` : ''}total ${money(spent)}`)
    }
  }

  const out = writeReport(rows, skipped, stoppedEarly, cases)
  console.log(`\nWrote ${out.md}\nWrote ${out.csv}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
