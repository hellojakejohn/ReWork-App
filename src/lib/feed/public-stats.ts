// Public numbers for the landing page's live jobs ticker: how many jobs are open right now,
// from how many employers, and a handful of the newest ones. Server only. Never throws:
// the landing renders without the ticker if the database can't be read (or at build time
// without one).
import { prisma } from '@/lib/prisma'

export interface TickerJob {
  title: string
  company: string
}

export interface JobsTicker {
  openJobs: number
  employers: number
  recent: TickerJob[]
}

const MAX_TITLE = 48
// Postings that aren't one real job: talent pools, internal-only, "general application".
const PLACEHOLDER = /^(internal|general|open|talent|future|interest|join|submit|apply)\b|talent (pool|community|network)|general application|open application|expression of interest/i

/** Short, single-line titles: drops req numbers and trailing location bits. */
export function tickerTitle(title: string): string | null {
  const clean = title
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s[-–|]\s.*$/, '')
    .replace(/#\s*\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!clean || clean.length > MAX_TITLE || PLACEHOLDER.test(clean)) return null
  return clean
}

/** One job per employer, newest first, titles that fit on one line. */
export function pickTicker(rows: { title: string; company: string }[], limit: number): TickerJob[] {
  const seen = new Set<string>()
  const out: TickerJob[] = []
  for (const row of rows) {
    const company = row.company.trim()
    const key = company.toLowerCase()
    if (!company || seen.has(key)) continue
    const title = tickerTitle(row.title)
    if (!title) continue
    seen.add(key)
    out.push({ title, company })
    if (out.length >= limit) break
  }
  return out
}

export async function jobsTicker(limit = 24): Promise<JobsTicker | null> {
  try {
    const [counts, rows] = await Promise.all([
      prisma.$queryRaw<{ jobs: number; employers: number }[]>`
        SELECT COUNT(*)::int AS jobs, COUNT(DISTINCT lower(company))::int AS employers
        FROM "jobs" WHERE "closedAt" IS NULL`,
      // The newest job at each employer, so one big board can't fill the ticker.
      prisma.$queryRaw<{ title: string; company: string }[]>`
        SELECT title, company FROM (
          SELECT DISTINCT ON (lower(company)) title, company, "firstSeenAt"
          FROM "jobs" WHERE "closedAt" IS NULL AND country = 'us' AND length(title) <= 80
          ORDER BY lower(company), "firstSeenAt" DESC
        ) newest
        ORDER BY "firstSeenAt" DESC
        LIMIT 120`,
    ])
    const openJobs = counts[0]?.jobs ?? 0
    if (openJobs < 100) return null
    return { openJobs, employers: counts[0]?.employers ?? 0, recent: pickTicker(rows, limit) }
  } catch (error) {
    console.error('[jobs-ticker] skipped:', (error as Error)?.message)
    return null
  }
}
