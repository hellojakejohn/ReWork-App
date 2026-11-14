// Job feed spike (docs/job-feed-plan.md). Three steps:
//   npm run feed:spike -- pull               free: every open job on the boards below
//   npm run feed:spike -- rank               free: prefilter each resume against them
//   npm run feed:spike -- score --max-usd 2  BILLED: keywords for each resume's top jobs, then
//                                            the real Job match (ask Jake for a budget)
// Data in eval-results/feed/ (gitignored). No database reads or writes.
import { loadEnvConfig } from '@next/env'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { boardListUrl, dedupeJobs, parseBoardList, roleKey, type Board, type FeedJob } from '@/lib/feed/boards'
import { prescore, resumeProfile, type FeedPrefs } from '@/lib/feed/prefilter'
import { masterToParsed } from '@/lib/master-resume'
import { extractJobKeywords, fitCoverage } from '@/lib/skill-check'
import { ghostSignals, scamSignals, postedDaysAgo } from '@/lib/job-checks'
import { payFromText } from '@/lib/pay'
import { collectUsage } from '@/lib/ai-usage'
import type { ParsedResume } from '@/types/parsed-resume'

loadEnvConfig(process.cwd())

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, '..', 'eval-results', 'feed')
const JOBS = path.join(OUT, 'jobs.json')
const RANK = path.join(OUT, 'rank.json')
const KEYWORDS = path.join(OUT, 'keywords.json') // job key -> keywords (the shared, once-per-job cache)
const argv = process.argv.slice(2)
const arg = (name: string) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? undefined : argv[i + 1]
}

const BOARDS: Board[] = [
  ...['stripe', 'airbnb', 'figma', 'discord', 'coinbase', 'robinhood', 'dropbox', 'gitlab', 'cloudflare', 'datadog', 'instacart', 'reddit', 'lyft', 'pinterest', 'twitch', 'duolingo', 'asana', 'brex', 'chime', 'gusto', 'affirm', 'samsara', 'toast', 'webflow', 'squarespace', 'flexport', 'andurilindustries', 'databricks', 'mongodb', 'elastic', 'okta', 'twilio', 'peloton', 'sweetgreen'].map((slug) => ({ ats: 'greenhouse' as const, slug })),
  ...['palantir', 'spotify', 'kraken', 'whoop', 'zoox'].map((slug) => ({ ats: 'lever' as const, slug })),
  ...['ramp', 'notion', 'linear', 'openai', 'vercel', 'supabase', 'deel', 'posthog', 'replit', 'cursor'].map((slug) => ({ ats: 'ashby' as const, slug })),
]

// The public fixtures stand in for real users. targetTitles is the "what do you want next"
// preference the MVP would ask for; the career changer is run both ways.
interface Person {
  name: string
  resume: ParsedResume
  prefs: FeedPrefs
}
function people(): Person[] {
  const out: Person[] = []
  for (const f of readdirSync(path.join(HERE, 'fixtures')).filter((f) => f.endsWith('.json')).sort()) {
    const fx = JSON.parse(readFileSync(path.join(HERE, 'fixtures', f), 'utf8'))
    const resume = masterToParsed(fx.resume)
    const name = f.replace(/\.json$/, '')
    // Everyone is in Saint Paul, MN: remote jobs or on-site near home, as the MVP would ask.
    out.push({ name, resume, prefs: { onsiteNearHomeOnly: true } })
    if (name.startsWith('restaurant'))
      out.push({ name: `${name} +target`, resume, prefs: { onsiteNearHomeOnly: true, targetTitles: ['Operations Coordinator', 'Operations Manager', 'Operations Associate'] } })
  }
  return out
}

const readJson = <T>(p: string, fallback: T): T => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : fallback)
const write = (p: string, v: unknown) => (mkdirSync(OUT, { recursive: true }), writeFileSync(p, JSON.stringify(v, null, 2)))

async function pull() {
  const all: FeedJob[] = []
  const perBoard: Record<string, number> = {}
  const started = Date.now()
  for (const board of BOARDS) {
    try {
      const res = await fetch(boardListUrl(board), { headers: { 'user-agent': 'ReWork job feed spike' }, signal: AbortSignal.timeout(30_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const jobs = parseBoardList(board, await res.json())
      perBoard[`${board.ats}:${board.slug}`] = jobs.length
      all.push(...jobs)
    } catch (e) {
      perBoard[`${board.ats}:${board.slug}`] = -1
      console.log(`  ${board.ats}:${board.slug} failed: ${(e as Error).message}`)
    }
  }
  const unique = dedupeJobs(all)
  const now = new Date()
  const age = unique.map((j) => postedDaysAgo(j.facts?.posted, now)?.days).filter((d): d is number => d != null)
  const scams = unique.filter((j) => scamSignals(j.description).length > 0)
  const ghosts = unique.filter((j) => ghostSignals(j.description, j.facts, now).some((g) => g.id === 'old' || g.id === 'closed'))
  write(JOBS, unique)
  console.log(`${BOARDS.length} boards, ${all.length} jobs, ${unique.length} after dedupe, ${((Date.now() - started) / 1000).toFixed(0)}s`)
  console.log(`posted date known: ${age.length}; median age ${median(age)} days; older than 30 days: ${age.filter((d) => d > 30).length}`)
  console.log(`pay in the post: ${unique.filter((j) => payFromText(j.description)).length}; remote: ${unique.filter((j) => /remote/i.test(j.location)).length}`)
  console.log(`scam signals: ${scams.length}; old or closed: ${ghosts.length}`)
  console.log(`per board: ${Object.entries(perBoard).map(([k, v]) => `${k.split(':')[1]} ${v}`).join(', ')}`)
}

function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

function rank() {
  const jobs = readJson<FeedJob[]>(JOBS, [])
  if (!jobs.length) throw new Error('Run pull first')
  const top = Number(arg('top') ?? 25)
  const out: Record<string, { key: string; title: string; company: string; location: string; pre: number; hits: string[] }[]> = {}
  for (const p of people()) {
    const profile = resumeProfile(p.resume, p.prefs)
    const scored = jobs
      .map((j) => ({ j, s: prescore(j, profile, p.prefs) }))
      .filter((x) => !x.s.dropped && scamSignals(x.j.description).length === 0)
      .sort((a, b) => b.s.score - a.s.score)
      .filter(((seen) => (x: { j: FeedJob }) => !seen.has(roleKey(x.j)) && !!seen.add(roleKey(x.j)))(new Set<string>()))
    const dropped = jobs.length - scored.length
    const passing = scored.filter((x) => x.s.score >= 40).length
    out[p.name] = scored.slice(0, top).map(({ j, s }) => ({ key: j.key, title: j.title, company: j.company, location: j.location, pre: s.score, hits: s.skillHits }))
    console.log(`\n=== ${p.name}  (${profile.years} yrs, titles: ${[...profile.titleWords].join(' ')})`)
    console.log(`kept ${scored.length} of ${jobs.length} (${dropped} outside the US, on-site elsewhere, scam or same role in another city); prefilter >= 40: ${passing}`)
    out[p.name].slice(0, 12).forEach((r, i) => console.log(`${String(i + 1).padStart(2)}. ${r.pre}  ${r.title} @ ${r.company} (${r.location})  [${r.hits.slice(0, 5).join(', ')}]`))
  }
  write(RANK, out)
}

async function score() {
  const maxUsd = Number(arg('max-usd') ?? 1)
  const perPerson = Number(arg('per') ?? 15)
  const jobs = new Map(readJson<FeedJob[]>(JOBS, []).map((j) => [j.key, j]))
  const ranked = readJson<Record<string, { key: string; pre: number }[]>>(RANK, {})
  if (!Object.keys(ranked).length) throw new Error('Run rank first')
  const cache = readJson<Record<string, string[]>>(KEYWORDS, {})
  let spent = 0
  let calls = 0
  const ms: number[] = []
  const report: Record<string, unknown[]> = {}

  for (const p of people()) {
    const rows: { pre: number; match: number; title: string; company: string; location: string; missing: string[]; pay: string | null }[] = []
    // Below 30 the prefilter is saying "not your kind of job": don't pay to confirm it.
    for (const r of (ranked[p.name] ?? []).filter((r) => r.pre >= 30).slice(0, perPerson)) {
      const job = jobs.get(r.key)
      if (!job) continue
      if (!cache[r.key]) {
        if (spent >= maxUsd) {
          console.log(`  budget reached ($${spent.toFixed(3)}), stopping extraction`)
          break
        }
        const { run, records } = collectUsage(() => extractJobKeywords(job))
        const t = Date.now()
        try {
          cache[r.key] = await run
          ms.push(Date.now() - t)
          calls++
        } catch (e) {
          console.log(`  keywords failed for ${job.title}: ${(e as Error).message}`)
          continue
        } finally {
          spent += records().reduce((s, x) => s + x.costUsd, 0)
          write(KEYWORDS, cache)
        }
      }
      const cov = fitCoverage(cache[r.key], p.resume)
      rows.push({ pre: r.pre, match: cov.score, title: job.title, company: job.company, location: job.location, missing: cov.missing.slice(0, 5), pay: payFromText(job.description)?.label ?? null })
    }
    rows.sort((a, b) => b.match - a.match)
    report[p.name] = rows
    console.log(`\n=== ${p.name}`)
    rows.forEach((r, i) => console.log(`${String(i + 1).padStart(2)}. match ${r.match}% (pre ${r.pre})  ${r.title} @ ${r.company} (${r.location})${r.pay ? `  ${r.pay}` : ''}\n      missing: ${r.missing.join(', ') || 'nothing'}`))
  }
  write(path.join(OUT, `score-${new Date().toISOString().replace(/[:.]/g, '-')}.json`), report)
  console.log(`\n${calls} new keyword extractions, $${spent.toFixed(4)} ($${calls ? (spent / calls).toFixed(4) : 0} each), median ${median(ms)} ms`)
}

const step = argv[0]
const run = step === 'pull' ? pull : step === 'rank' ? async () => rank() : step === 'score' ? score : null
if (!run) {
  console.log('Usage: npm run feed:spike -- pull | rank [--top 25] | score --max-usd 1 [--per 15]')
  process.exit(1)
}
void run().catch((e) => {
  console.error(e)
  process.exit(1)
})
