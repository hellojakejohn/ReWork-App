// Matches on upload, chunk 6: the real-data check. BILLED (ask Jake for a budget).
//   npm run feed:check -- --max-usd 2 [--people]
// Runs the real pipeline (runMatch) end to end: today's boards (pullListBoards), the Workday
// search, description fetches and real keyword calls, on an in-memory copy of the tables.
// No database reads or writes. Output in eval-results/feed/check-*.json (gitignored).
import { loadEnvConfig } from '@next/env'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LIST_BOARDS } from '@/lib/feed/board-list'
import { pullListBoards } from '@/lib/feed/sync'
import { runMatch, type MatchPrefs } from '@/lib/feed/match'
import { masterToParsed } from '@/lib/master-resume'
import { collectUsage } from '@/lib/ai-usage'
import { scamSignals } from '@/lib/job-checks'
import type { ParsedResume } from '@/types/parsed-resume'

loadEnvConfig(process.cwd())

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, '..', 'eval-results', 'feed')
const argv = process.argv.slice(2)
const maxUsd = Number(argv[argv.indexOf('--max-usd') + 1] ?? NaN)

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

// In-memory prisma: only the queries the pull and the matcher make (same as the tests).
function memoryDb() {
  const job = new Map<string, Row>()
  const matches = new Map<string, Row>()
  const prefs = new Map<string, Row>()
  const where = (r: Row, w: Row): boolean =>
    Object.entries(w).every(([k, v]) => {
      if (k === 'OR') return (v as Row[]).some((o) => where(r, o))
      if (v && typeof v === 'object' && 'in' in v) return (v.in as string[]).includes(r[k])
      if (v && typeof v === 'object' && 'not' in v) return r[k] !== v.not
      return (r[k] ?? null) === v
    })
  const db = {
    job: {
      findMany: async ({ where: w }: Row) => {
        if (w.id?.in) return (w.id.in as string[]).map((id) => job.get(id)).filter(Boolean).map((r) => ({ ...r }))
        return [...job.values()].filter((r) => where(r, w)).map((r) => ({ ...r }))
      },
      createMany: async ({ data }: Row) => {
        for (const d of data) if (!job.has(d.id)) job.set(d.id, { closedAt: null, ...d })
        return { count: data.length }
      },
      updateMany: async ({ where: w, data }: Row) => {
        const ids: string[] | undefined = w.id?.in
        const hit = ids ? ids.map((id) => job.get(id)).filter(Boolean) as Row[] : [...job.values()].filter((r) => where(r, w))
        hit.forEach((r) => Object.assign(r, data))
        return { count: hit.length }
      },
      update: async ({ where: w, data }: Row) => Object.assign(job.get(w.id)!, data),
    },
    jobMatch: {
      upsert: async ({ where: w, create, update }: Row) => {
        const k = `${w.resumeId_jobId.resumeId}|${w.resumeId_jobId.jobId}`
        matches.set(k, matches.has(k) ? { ...matches.get(k), ...update } : { ...create })
      },
    },
    feedPrefs: { upsert: async ({ where: w, create, update }: Row) => prefs.set(w.resumeId, { ...(prefs.get(w.resumeId) ?? create), ...update }) },
  }
  return { db: db as never, job, matches }
}

interface Person {
  name: string
  resume: ParsedResume
  prefs: MatchPrefs
}

// Everyone lives in Saint Paul, MN and answers the one question as the screen prefills it
// (their latest title), "Remote or near me". The career changer types the job they want.
// --people: the non-tech test people in fixtures/people, each asking for their fixture job's title.
const PEOPLE = argv.includes('--people')

function people(): Person[] {
  const out: Person[] = []
  const dir = path.join(HERE, 'fixtures', PEOPLE ? 'people' : '')
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const fx = JSON.parse(readFileSync(path.join(dir, f), 'utf8'))
    const resume = masterToParsed(fx.resume)
    if (PEOPLE) {
      resume.contact.location = 'Saint Paul, MN'
      out.push({ name: `${f.replace(/\.json$/, '')} (as "${fx.job.title}")`, resume, prefs: { targetTitles: [fx.job.title], workplace: 'both' } })
      continue
    }
    resume.contact.location = 'Saint Paul, MN'
    const name = f.replace(/\.json$/, '')
    const latest = resume.experience[0]?.title ?? ''
    out.push({ name: `${name} (as "${latest}")`, resume, prefs: { targetTitles: [latest], workplace: 'both' } })
    if (name.startsWith('restaurant')) out.push({ name: `${name} (as "Operations Coordinator")`, resume, prefs: { targetTitles: ['Operations Coordinator'], workplace: 'both' } })
  }
  return out
}

async function main() {
  if (!(maxUsd > 0)) throw new Error('Pass --max-usd (this makes billed model calls).')
  const { db, job, matches } = memoryDb()

  console.log(`Pulling ${LIST_BOARDS.length} boards...`)
  const pull = await pullListBoards(db, LIST_BOARDS, { deadlineMs: 600_000 })
  console.log(`  ${pull.ok} ok, ${pull.failed.length} failed, ${pull.listed} jobs in ${Math.round(pull.ms / 1000)}s`)
  for (const f of pull.failed) console.log(`  failed: ${f}`)

  // Keywords the spike already bought (same job ids): the shared once-per-job cache.
  const cache = path.join(OUT, 'keywords.json')
  if (existsSync(cache)) {
    let reused = 0
    for (const [id, kw] of Object.entries(JSON.parse(readFileSync(cache, 'utf8')) as Record<string, string[]>)) {
      const j = job.get(id)
      if (j && kw.length >= 5) {
        j.keywords = kw
        reused++
      }
    }
    console.log(`  reused keywords for ${reused} jobs from the spike`)
  }

  let spent = (): number => 0
  let again: Row = {}
  const report: Row[] = []
  const { run, usage } = collectUsage(async () => {
    for (const p of people()) {
      const resumeId = p.name
      const before = spent()
      const r = await runMatch({ db, canSpend: () => spent() < maxUsd - 0.1 }, { userId: 'check', resumeId, resume: p.resume, prefs: p.prefs })
      const mine = [...matches.values()].filter((m) => m.resumeId === resumeId).sort((a, b) => b.rank - a.rank || b.score - a.score || b.prescore - a.prescore)
      const top = mine.map((m) => {
        const j = job.get(m.jobId)!
        return { score: m.score, rank: m.rank, prescore: m.prescore, title: j.title, company: j.company, location: j.location, remote: j.remote, pay: j.payLabel, source: j.source, missing: m.missing.slice(0, 5), scam: scamSignals(j.description).map((s: { id?: string }) => s.id ?? s), url: j.url }
      })
      const cost = spent() - before
      report.push({ person: p.name, run: r, costUsd: Number(cost.toFixed(4)), matches: top })
      console.log(`\n${p.name}: ${top.length} matches, ${r.extracted} keyword calls, ${r.fetched} fetched, workday ${r.workdayJobs}, pool ${r.pool}, $${cost.toFixed(3)}, ${Math.round(r.ms / 1000)}s`)
      for (const m of top.slice(0, 10)) console.log(`  ${String(m.score).padStart(3)}% (rank ${String(m.rank).padStart(3)})  ${m.title} | ${m.company} | ${m.location.slice(0, 40)}${m.pay ? ` | ${m.pay}` : ''}${m.scam.length ? ` | SCAM? ${m.scam.join(',')}` : ''}`)
      if (spent() >= maxUsd - 0.1) console.log('  (budget reached: later runs only use keywords already bought)')
    }
    // Second run for the first person: keywords are on the jobs now, so it should cost ~0.
    const p = people()[0]
    const before = spent()
    again = await runMatch({ db, canSpend: () => spent() < maxUsd - 0.1 }, { userId: 'check', resumeId: p.name, resume: p.resume, prefs: p.prefs })
    console.log(`\nRepeat run for ${p.name}: ${again.extracted} keyword calls, $${(spent() - before).toFixed(3)}, ${Math.round(again.ms / 1000)}s`)

  })
  spent = () => usage().costUsd
  await run

  console.log(`\nTotal model spend: $${usage().costUsd.toFixed(3)} (cap $${maxUsd})`)
  mkdirSync(OUT, { recursive: true })
  // Keep what was bought, so the next check doesn't pay for the same jobs again.
  const bought = Object.fromEntries([...job.values()].filter((j) => j.keywords?.length >= 5).map((j) => [j.id, j.keywords]))
  writeFileSync(cache, JSON.stringify(bought))
  const file = path.join(OUT, `check-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(file, JSON.stringify({ pull, totalUsd: usage().costUsd, repeat: again, report }, null, 2))
  console.log(`Saved ${file}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
