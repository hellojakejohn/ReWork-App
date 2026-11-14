// Matches on upload: the server side around runMatch (src/lib/feed/match.ts). Who may run it,
// what it may spend, and what gets logged. Server only.
import { prisma } from '@/lib/prisma'
import { getAIBudget } from '@/lib/ai-cap'
import { collectUsage, usageProps } from '@/lib/ai-usage'
import { startOfUtcDay } from '@/lib/daily-ceiling'
import { getAccess } from '@/lib/entitlements'
import { masterToParsed } from '@/lib/master-resume'
import { FEED_RUNS_PER_DAY, FREE_FEED_MATCHES, PRO_FEED_MATCHES } from '@/lib/plans'
import { track } from '@/lib/track'
import { isWorkplace, listMatches, runMatch, type MatchPrefs, type MatchRun, type Workplace } from './match'

/**
 * Today's ceiling on what the feed spends on job keywords, for everyone together. Separate
 * from the per-user AI caps: keywords are bought once per job and shared. 0 = no ceiling.
 */
export function feedDailyCeilingUsd(): number {
  const n = Number(process.env.AI_FEED_DAILY_USD)
  return Number.isFinite(n) && n >= 0 && process.env.AI_FEED_DAILY_USD?.trim() ? n : 5
}

/** Today's feed keyword spend (feedUsd on feed_match events). Null if unreadable. */
export async function feedSpentToday(now = new Date()): Promise<number | null> {
  try {
    const rows = await prisma.$queryRaw<{ spent: number }[]>`
      SELECT COALESCE(SUM((props->>'feedUsd')::numeric), 0)::float8 AS spent
      FROM "events" WHERE name = 'feed_match' AND "createdAt" >= ${startOfUtcDay(now)}`
    return Number(rows[0]?.spent ?? 0)
  } catch {
    return null
  }
}

export async function feedRunsToday(userId: string, resumeId: string, now = new Date()): Promise<number> {
  try {
    return await prisma.event.count({ where: { userId, name: 'feed_match', createdAt: { gte: startOfUtcDay(now) }, props: { path: ['resumeId'], equals: resumeId } } })
  } catch {
    return 0
  }
}

export function readPrefs(body: unknown, fallback: MatchPrefs): MatchPrefs {
  const b = (body ?? {}) as { targetTitles?: unknown; workplace?: unknown }
  const titles = Array.isArray(b.targetTitles)
    ? b.targetTitles.filter((t): t is string => typeof t === 'string').map((t) => t.replace(/\s+/g, ' ').trim().slice(0, 80)).filter(Boolean).slice(0, 3)
    : fallback.targetTitles
  return { targetTitles: titles, workplace: isWorkplace(b.workplace) ? b.workplace : fallback.workplace }
}

export async function loadPrefs(resumeId: string): Promise<(MatchPrefs & { matchedAt: Date | null }) | null> {
  const row = await prisma.feedPrefs.findUnique({ where: { resumeId } })
  if (!row) return null
  return { targetTitles: row.targetTitles, workplace: (isWorkplace(row.workplace) ? row.workplace : 'both') as Workplace, matchedAt: row.matchedAt }
}

export async function savePrefs(userId: string, resumeId: string, prefs: MatchPrefs): Promise<void> {
  await prisma.feedPrefs.upsert({
    where: { resumeId },
    create: { resumeId, userId, targetTitles: prefs.targetTitles, workplace: prefs.workplace },
    update: { targetTitles: prefs.targetTitles, workplace: prefs.workplace },
  })
}

export async function matchLimit(userId: string): Promise<{ isPro: boolean; limit: number }> {
  const access = await getAccess(userId)
  return { isPro: access.isPro, limit: access.isPro ? PRO_FEED_MATCHES : FREE_FEED_MATCHES }
}

export type RunOutcome = { ok: true; run: MatchRun } | { ok: false; status: number; error: string }

/** One match run for one resume: limits, budget, the run, and its event. */
export async function matchForResume(userId: string, resume: { id: string } & Parameters<typeof masterToParsed>[0], prefs: MatchPrefs): Promise<RunOutcome> {
  if ((await feedRunsToday(userId, resume.id)) >= FEED_RUNS_PER_DAY) {
    return { ok: false, status: 429, error: `You've refreshed this resume's matches ${FEED_RUNS_PER_DAY} times today. New jobs come in every morning.` }
  }
  const ai = await getAIBudget(userId)
  const ceiling = feedDailyCeilingUsd()
  let spentAtStart = ceiling > 0 ? await feedSpentToday() : 0
  // Unreadable spend: go ahead without buying keywords (jobs already done still match).
  const canBuy = ai.state.band !== 'paused' && spentAtStart !== null
  spentAtStart ??= 0

  // The person's own AI routing and spend logging, but not their in-flight slot: these calls
  // are short and shared, and the run would otherwise crawl at two at a time.
  let spentThisRun = (): number => 0
  const canSpend = (): boolean => canBuy && (ceiling === 0 || spentAtStart! + spentThisRun() < ceiling)
  const { run, usage } = collectUsage<MatchRun>(
    () => runMatch({ db: prisma, canSpend }, { userId, resumeId: resume.id, resume: masterToParsed(resume), prefs }),
    { ...ai.scope, slot: undefined }
  )
  spentThisRun = () => usage().costUsd
  try {
    const result = await run
    await track('feed_match', { resumeId: resume.id, ok: true, ...flat(result), feedUsd: usage().costUsd, ...usageProps(usage()) }, userId)
    return { ok: true, run: result }
  } catch (error) {
    console.error('[feed] match run failed:', (error as Error)?.message)
    await track('feed_match', { resumeId: resume.id, ok: false, feedUsd: usage().costUsd, ...usageProps(usage()) }, userId)
    return { ok: false, status: 500, error: "We couldn't look for jobs just now. Please try again in a minute." }
  } finally {
    await ai.settle(usage().costUsd)
  }
}

const flat = (r: MatchRun) => ({ searched: r.searched.join(' | '), workdayJobs: r.workdayJobs, usajobsJobs: r.usajobsJobs, pool: r.pool, scored: r.scored, extracted: r.extracted, fetched: r.fetched, skippedNoBudget: r.skippedNoBudget, ms: r.ms })

export { listMatches }
