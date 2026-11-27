// Matches on upload, chunk 2: keep the shared `jobs` table in step with the company boards.
// New jobs are added, jobs still listed are marked seen, jobs gone from a fully read board are
// closed (the honest "this job is closed" signal). Never deletes.
import type { Prisma, PrismaClient } from '@prisma/client'
import { payFromText } from '@/lib/pay'
import { boardId, boardListUrl, parseBoardList, type Board, type FeedJob } from './boards'
import { isRemote, locationCountry, usState } from './prefilter'

export type JobRow = Prisma.JobCreateManyInput

/** A parsed board job as a `jobs` row: place, remote and pay worked out once, here. */
export function toJobRow(job: Omit<FeedJob, 'facts'> & { facts?: FeedJob['facts']; postedAt?: Date | null }, now = new Date()): JobRow {
  const posted = job.postedAt ?? (job.facts?.posted && /^\d{4}-\d{2}-\d{2}/.test(job.facts.posted) ? new Date(job.facts.posted) : null)
  return {
    id: job.key,
    source: job.source,
    board: job.board,
    company: job.company.slice(0, 200),
    title: job.title.slice(0, 300),
    location: job.location.slice(0, 300),
    remote: isRemote(job.location, job.description),
    usState: usState(job.location),
    country: locationCountry(job.location),
    payLabel: payFromText(job.description)?.label ?? null,
    postedAt: posted && !Number.isNaN(posted.getTime()) ? posted : null,
    description: job.description.slice(0, 50_000),
    url: job.url.slice(0, 2000),
    keywords: [],
    firstSeenAt: now,
    lastSeenAt: now,
  }
}

type Db = Pick<PrismaClient, 'job'>

const chunks = <T>(xs: T[], n = 500): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

export interface SyncResult {
  board: string
  listed: number
  added: number
  closed: number
  reopened: number
}

/**
 * Write one board's current jobs. `complete` means `rows` is the whole board (a full list
 * read), so anything missing has closed. Search results (Workday) pass false: absence there
 * means nothing.
 */
export async function syncBoard(db: Db, board: string, rows: JobRow[], { complete, now = new Date() }: { complete: boolean; now?: Date }): Promise<SyncResult> {
  const ids = rows.map((r) => r.id)
  const existing = new Map(
    (await db.job.findMany({ where: complete ? { board } : { id: { in: ids } }, select: { id: true, closedAt: true } })).map((j) => [j.id, j.closedAt])
  )
  const fresh = rows.filter((r) => !existing.has(r.id))
  for (const part of chunks(fresh)) await db.job.createMany({ data: part, skipDuplicates: true })

  const seen = ids.filter((id) => existing.has(id))
  const reopened = seen.filter((id) => existing.get(id) != null).length
  for (const part of chunks(seen)) await db.job.updateMany({ where: { id: { in: part } }, data: { lastSeenAt: now, closedAt: null } })

  let closed = 0
  if (complete) {
    const listed = new Set(ids)
    const gone = [...existing].filter(([id, closedAt]) => closedAt == null && !listed.has(id)).map(([id]) => id)
    for (const part of chunks(gone)) closed += (await db.job.updateMany({ where: { id: { in: part } }, data: { closedAt: now } })).count
  }
  return { board, listed: rows.length, added: fresh.length, closed, reopened }
}

export interface PullSummary {
  boards: number
  ok: number
  failed: string[]
  skipped: number
  listed: number
  added: number
  closed: number
  ms: number
}

/**
 * Read every full-list board and sync it, a few at a time, stopping cleanly before
 * `deadlineMs` (the cron has 300 s). Boards not reached just wait for tomorrow: nothing is
 * closed for a board that wasn't read.
 */

/** Longest wait for one board's full list (the biggest is about 46 MB). */
export const BOARD_TIMEOUT_MS = 90_000
export async function pullListBoards(
  db: Db,
  boards: Board[],
  { fetchFn = fetch, concurrency = 6, deadlineMs = 240_000, now = new Date() }: { fetchFn?: typeof fetch; concurrency?: number; deadlineMs?: number; now?: Date } = {}
): Promise<PullSummary> {
  const started = Date.now()
  const sum: PullSummary = { boards: boards.length, ok: 0, failed: [], skipped: 0, listed: 0, added: 0, closed: 0, ms: 0 }
  // Rotate the start daily, so if a run hits the deadline it's never the same boards waiting.
  const offset = Math.floor(now.getTime() / 86_400_000) % Math.max(boards.length, 1)
  const queue = [...boards.slice(offset), ...boards.slice(0, offset)]

  const worker = async () => {
    for (let board = queue.shift(); board; board = queue.shift()) {
      if (Date.now() - started > deadlineMs) {
        sum.skipped++
        continue
      }
      const id = boardId(board)
      try {
        // Big boards are big: Anduril's full list is about 46 MB and timed out daily at 30s
        // (Nov 20 to 27). Give each board up to 90s, but never past deadline + 30s, so the
        // route still finishes inside its 300s.
        const left = deadlineMs + 30_000 - (Date.now() - started)
        const timeoutMs = Math.max(10_000, Math.min(BOARD_TIMEOUT_MS, left))
        const res = await fetchFn(boardListUrl(board), { headers: { accept: 'application/json', 'user-agent': 'ReWork job feed' }, signal: AbortSignal.timeout(timeoutMs) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const jobs = parseBoardList(board, await res.json())
        // An empty answer from a board that had jobs is more likely a hiccup than every job
        // closing at once: treat it as not read.
        const r = await syncBoard(db, id, jobs.map((j) => toJobRow(j, now)), { complete: jobs.length > 0, now })
        sum.ok++
        sum.listed += r.listed
        sum.added += r.added
        sum.closed += r.closed
      } catch (e) {
        sum.failed.push(`${id}: ${String((e as Error)?.message ?? e).slice(0, 120)}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, boards.length) }, worker))
  sum.ms = Date.now() - started
  return sum
}

/**
 * Jobs we only find by searching (Workday, USAJOBS, Adzuna) can't be closed by a full board read.
 * Close them once nobody's search has seen them for a while: 30 days for Workday, 14 for
 * USAJOBS (federal postings are short), unless someone saved or tailored them.
 */
export async function closeStaleSearched(db: Db, now = new Date()): Promise<number> {
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000)
  // A job someone saved or tailored stays: unseen by search is no proof it closed, and it
  // must not vanish from their list.
  const kept = { matches: { none: { OR: [{ savedAt: { not: null } }, { applicationId: { not: null } }] } } }
  const workday = await db.job.updateMany({ where: { source: 'workday', closedAt: null, lastSeenAt: { lt: daysAgo(30) }, ...kept }, data: { closedAt: now } })
  const federal = await db.job.updateMany({ where: { source: 'usajobs', closedAt: null, lastSeenAt: { lt: daysAgo(14) }, ...kept }, data: { closedAt: now } })
  // Adzuna ads are short-lived and re-found by the next search when still up.
  const adzuna = await db.job.updateMany({ where: { source: 'adzuna', closedAt: null, lastSeenAt: { lt: daysAgo(21) }, ...kept }, data: { closedAt: now } })
  // SmartRecruiters companies read only in part (Domino's: newest 2,000 of 25k). Fully read
  // ones are seen daily, so this never touches them.
  const partial = await db.job.updateMany({ where: { source: 'smartrecruiters', closedAt: null, lastSeenAt: { lt: daysAgo(14) }, ...kept }, data: { closedAt: now } })
  return workday.count + federal.count + adzuna.count + partial.count
}

export const PURGE_CLOSED_AFTER_DAYS = 60

/**
 * Delete jobs closed more than 60 days ago, so the table (most of the database) doesn't grow
 * forever on Supabase's free 500 MB. Their matches go with them (cascade). Jobs someone saved
 * or tailored stay, like in closeStaleSearched. Tracker entries don't point at jobs, so
 * nobody's applications change.
 */
export async function purgeClosedJobs(db: Db, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - PURGE_CLOSED_AFTER_DAYS * 86_400_000)
  const kept = { matches: { none: { OR: [{ savedAt: { not: null } }, { applicationId: { not: null } }] } } }
  const { count } = await db.job.deleteMany({ where: { closedAt: { lt: cutoff }, ...kept } })
  return count
}

