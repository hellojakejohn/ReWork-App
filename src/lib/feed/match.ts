// Matches on upload, chunk 3: score the shared jobs against one resume and save the best.
//   1. Search the Workday employers for the person's target title (adds jobs to the pool).
//   2. Free passes: title against every open job in their area, then title + skills on the
//      best few hundred.
//   3. For the top jobs: fetch the full text when we only have a title (Workday), and the
//      Job match keywords when the job has none yet (one model call per job, ever, shared).
//   4. The real Job match (src/lib/keyword-coverage.ts) decides the score, never the prefilter.
import type { PrismaClient } from '@prisma/client'
import { matchAtsUrl, parseAtsResponse } from '@/lib/job-resolve/ats'
import { extractJobKeywords, fitCoverage } from '@/lib/skill-check'
import { weightedScore } from '@/lib/keyword-coverage'
import type { ParsedResume } from '@/types/parsed-resume'
import { parseWorkdaySearch, roleKey, workdaySearchRequest, type WorkdayBoard } from './boards'
import { WORKDAY_BOARDS } from './board-list'
import { prescore, resumeProfile, stateName, titleFit, usState } from './prefilter'
import { syncBoard, toJobRow } from './sync'
import { payFromText } from '@/lib/pay'

export type Workplace = 'remote' | 'near' | 'both'
export const WORKPLACES: Workplace[] = ['remote', 'near', 'both']
export const isWorkplace = (v: unknown): v is Workplace => v === 'remote' || v === 'near' || v === 'both'

export interface MatchPrefs {
  targetTitles: string[]
  workplace: Workplace
}

/** How many jobs get the real Job match per run (each may need one model call the first time). */
export const MATCH_TOP = 25
/** Jobs that get the free title + skills pass. */
const TITLE_POOL = 200
/** Below this the prefilter says "not your kind of job": not worth a model call. */
export const MIN_PRESCORE = 30

type Db = Pick<PrismaClient, 'job' | 'jobMatch' | 'feedPrefs'>

export interface MatchDeps {
  db: Db
  fetchFn?: typeof fetch
  /** Job match keywords for one job (a model call). */
  extract?: (job: { title: string; company: string; description: string }) => Promise<string[]>
  /** Asked before each model call: false once a spend ceiling is reached or AI is paused. */
  canSpend?: () => Promise<boolean> | boolean
  workdayBoards?: WorkdayBoard[]
  now?: Date
}

export interface MatchRun {
  searched: string[]
  workdayJobs: number
  pool: number
  scored: number
  extracted: number
  fetched: number
  skippedNoBudget: number
  ms: number
}

/**
 * Workday search ignores where you live, and one page per employer is mostly other places.
 * So we also ask for "{title} {state}" and "{title} Remote", per where they want to work.
 */
export function workdayQueries(titles: string[], workplace: Workplace, homeState: string | null): string[] {
  const state = homeState ? stateName(homeState) : null
  return titles.flatMap((t) => [t, ...(workplace !== 'remote' && state ? [`${t} ${state}`] : []), ...(workplace !== 'near' || !state ? [`${t} Remote`] : [])])
}

/**
 * The list order: what the resume can honestly reach for this job (its words plus what it
 * shows in other words, which a tailor puts in the job's words), plus half the title fit. A
 * career changer who asks for "Operations Coordinator" sees Operations Coordinator jobs first
 * even when few of their exact words show yet, ahead of a Data Analyst job that happens to
 * share two of them.
 */
export function matchRank(reach: number, titleFit: number): number {
  return reach + Math.round(titleFit / 2)
}

/** What we search for: their target titles, else their latest job title. */
export function searchTitles(resume: ParsedResume, prefs: MatchPrefs): string[] {
  const own = prefs.targetTitles.map((t) => t.trim()).filter(Boolean)
  const titles = own.length ? own : resume.experience.slice(0, 1).map((e) => e.title.trim()).filter(Boolean)
  return [...new Set(titles)].slice(0, 2)
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items]
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item)
  }))
}

// Some employers (Allina, Nordstrom) answer 500 without a language.
const WORKDAY_HEADERS = { 'content-type': 'application/json', accept: 'application/json', 'accept-language': 'en-US' }

/** Step 1: ask every Workday employer for these searches, and keep what comes back. Returns how many different jobs. */
export async function searchWorkday(db: Db, queries: string[], { fetchFn = fetch, boards = WORKDAY_BOARDS, now = new Date() } = {}): Promise<number> {
  const found = new Set<string>()
  const tasks = boards.flatMap((b) => queries.map((t) => ({ b, t })))
  await pool(tasks, 24, async ({ b, t }) => {
    try {
      const req = workdaySearchRequest(b, t)
      const res = await fetchFn(req.url, { method: 'POST', body: req.body, headers: WORKDAY_HEADERS, signal: AbortSignal.timeout(10_000) })
      if (!res.ok) return
      const jobs = parseWorkdaySearch(b, await res.json(), now)
      if (!jobs.length) return
      await syncBoard(db as never, jobs[0].board, jobs.map((j) => toJobRow(j, now)), { complete: false, now })
      for (const j of jobs) found.add(j.key)
    } catch {
      // One employer timing out never stops the rest.
    }
  })
  return found.size
}

/** The open-job filter for where they want to work. Null home state: remote only for "near". */
export function placeFilter(workplace: Workplace, homeState: string | null) {
  const base = { closedAt: null, country: { not: 'other' } }
  if (workplace === 'remote' || !homeState) return { ...base, remote: true }
  if (workplace === 'near') return { ...base, usState: homeState }
  return { ...base, OR: [{ remote: true }, { usState: homeState }] }
}

/** Full text for a job we only know by title (Workday), through the resolver's own parser. */
async function fetchDescription(job: { url: string }, fetchFn: typeof fetch): Promise<{ description: string; payLabel: string | null } | null> {
  const ats = matchAtsUrl(job.url)
  if (!ats) return null
  try {
    const res = await fetchFn(ats.apiUrl, { headers: { accept: 'application/json', 'accept-language': 'en-US' }, signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return null
    const parsed = parseAtsResponse(ats, await res.json(), job.url)
    return parsed ? { description: parsed.description.slice(0, 50_000), payLabel: payFromText(parsed.description)?.label ?? null } : null
  } catch {
    return null
  }
}

export async function runMatch(deps: MatchDeps, input: { userId: string; resumeId: string; resume: ParsedResume; prefs: MatchPrefs }): Promise<MatchRun> {
  const started = Date.now()
  const { db, fetchFn = fetch, extract = (j) => extractJobKeywords(j), canSpend = () => true, now = new Date() } = deps
  const { userId, resumeId, resume, prefs } = input
  const run: MatchRun = { searched: searchTitles(resume, prefs), workdayJobs: 0, pool: 0, scored: 0, extracted: 0, fetched: 0, skippedNoBudget: 0, ms: 0 }

  const homeState = usState(resume.contact.location)
  run.workdayJobs = await searchWorkday(db, workdayQueries(run.searched, prefs.workplace, homeState), { fetchFn, boards: deps.workdayBoards ?? WORKDAY_BOARDS, now })

  // Step 2a: titles only, everything open in their area.
  const profilePrefs = { targetTitles: prefs.targetTitles.filter((t) => t.trim()) }
  const profile = resumeProfile(resume, profilePrefs)
  const open = await db.job.findMany({ where: placeFilter(prefs.workplace, homeState), select: { id: true, title: true, company: true, location: true } })
  run.pool = open.length
  const seenRole = new Set<string>()
  const byTitle = open
    .map((j) => ({ j, s: prescore({ title: j.title, location: j.location, description: '' }, profile) }))
    .filter((x) => x.s.title > 0)
    .sort((a, b) => b.s.score - a.s.score)
    .filter((x) => !seenRole.has(roleKey(x.j)) && !!seenRole.add(roleKey(x.j)))
    .slice(0, TITLE_POOL)

  // Step 2b: title + skills, with the text. Workday jobs have no text yet: they ride on title.
  const full = await db.job.findMany({
    where: { id: { in: byTitle.map((x) => x.j.id) } },
    select: { id: true, title: true, company: true, location: true, description: true, keywords: true, url: true, source: true },
  })
  const top = full
    .map((j) => {
      const s = prescore({ title: j.title, location: j.location, description: j.description }, profile)
      // A missing text can't show skills: give it the title-only score, which already is.
      return { j, score: j.description ? s.score : Math.round(s.title * 0.6), titleFit: titleFit(j.title, profile) }
    })
    .filter((x) => x.score >= MIN_PRESCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MATCH_TOP)

  // Step 3: text and keywords where missing. A few at a time; each job is done once, ever.
  const ready: { id: string; prescore: number; titleFit: number; keywords: string[] }[] = []
  await pool(top, 4, async ({ j, score, titleFit }) => {
    let description = j.description
    if (!description) {
      const got = await fetchDescription(j, fetchFn)
      if (!got) return
      description = got.description
      run.fetched++
      await db.job.update({ where: { id: j.id }, data: { description, payLabel: got.payLabel } })
    }
    let keywords = j.keywords
    if (keywords.length < 5) {
      if (!(await canSpend())) {
        run.skippedNoBudget++
        return
      }
      try {
        keywords = await extract({ title: j.title, company: j.company, description })
      } catch {
        return
      }
      run.extracted++
      await db.job.update({ where: { id: j.id }, data: { keywords, keywordsAt: now } })
      if (keywords.length < 5) return
    }
    ready.push({ id: j.id, prescore: score, titleFit, keywords })
  })

  // Step 4: the real Job match, saved. Saved / dismissed / tailored marks stay as they are.
  for (const r of ready) {
    const cov = fitCoverage(r.keywords, resume)
    const reach = weightedScore(r.keywords, [...cov.present, ...cov.related])
    const data = { score: cov.score, rank: matchRank(reach, r.titleFit), prescore: r.prescore, present: cov.present, related: cov.related, missing: cov.missing }
    await db.jobMatch.upsert({ where: { resumeId_jobId: { resumeId, jobId: r.id } }, create: { userId, resumeId, jobId: r.id, ...data }, update: data })
  }
  run.scored = ready.length
  await db.feedPrefs.upsert({
    where: { resumeId },
    create: { resumeId, userId, targetTitles: prefs.targetTitles, workplace: prefs.workplace, matchedAt: now },
    update: { matchedAt: now },
  })
  run.ms = Date.now() - started
  return run
}

export interface MatchDTO {
  id: string
  jobId: string
  score: number
  present: string[]
  related: string[]
  missing: string[]
  savedAt: string | null
  applicationId: string | null
  isNew: boolean
  job: { title: string; company: string; location: string; remote: boolean; payLabel: string | null; postedAt: string | null; url: string }
}

/** This resume's matches, best first (matchRank): open jobs only, dismissed ones hidden. */
export async function listMatches(db: Pick<PrismaClient, 'jobMatch'>, userId: string, resumeId: string, take: number): Promise<{ matches: MatchDTO[]; total: number }> {
  const where = { userId, resumeId, dismissedAt: null, job: { closedAt: null } }
  const [rows, total] = await Promise.all([
    db.jobMatch.findMany({
      where,
      orderBy: [{ rank: 'desc' }, { score: 'desc' }, { prescore: 'desc' }],
      take,
      include: { job: { select: { title: true, company: true, location: true, remote: true, payLabel: true, postedAt: true, url: true } } },
    }),
    db.jobMatch.count({ where }),
  ])
  return {
    total,
    matches: rows.map((m) => ({
      id: m.id,
      jobId: m.jobId,
      score: m.score,
      present: m.present,
      related: m.related,
      missing: m.missing,
      savedAt: m.savedAt?.toISOString() ?? null,
      applicationId: m.applicationId,
      isNew: !m.seenAt,
      job: { ...m.job, postedAt: m.job.postedAt?.toISOString() ?? null },
    })),
  }
}
