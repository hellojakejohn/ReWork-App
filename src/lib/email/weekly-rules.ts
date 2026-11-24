// Who gets the weekly email and which jobs go in it. Pure: no DB, no env.

export const WEEKLY_JOBS = 5
/** Sent at most once in this many days (the cron runs several times each Monday). */
export const WEEKLY_GAP_DAYS = 6
/** Only people who used ReWork in this many days. */
export const ACTIVE_DAYS = 90
/** The daily brief: at most once in this many hours (the cron runs a few times each morning). */
export const DAILY_GAP_HOURS = 20
const DAY = 86_400_000
const HOUR = 3_600_000

/** Who a run is for: the Monday weekly email, or the daily brief. */
export type Cadence = 'weekly' | 'daily'

export type SkipReason = 'off' | 'unsubscribed' | 'no_email' | 'inactive' | 'recent' | 'prefs_unreadable' | 'gets_daily' | 'gets_weekly'
/** Skips not worth an event row: the person is just on the other run, or already sent. */
export const QUIET_SKIPS = new Set(['recent', 'not_admin', 'gets_daily', 'gets_weekly'])

export function weeklySkipReason(
  u: { email: string | null; prefs: { weekly: boolean; daily?: boolean; lastWeeklyAt: Date | null; unsubscribedAt: Date | null } | null; lastActiveAt: Date | null },
  now: Date,
  cadence: Cadence = 'weekly'
): SkipReason | null {
  if (!u.email) return 'no_email'
  if (!u.prefs) return 'prefs_unreadable'
  if (u.prefs.unsubscribedAt) return 'unsubscribed'
  if (!u.prefs.weekly) return 'off'
  if (cadence === 'weekly' && u.prefs.daily) return 'gets_daily'
  if (cadence === 'daily' && !u.prefs.daily) return 'gets_weekly'
  if (!u.lastActiveAt || now.getTime() - u.lastActiveAt.getTime() > ACTIVE_DAYS * DAY) return 'inactive'
  if (u.prefs.lastWeeklyAt && u.prefs.lastWeeklyAt > sendCutoff(now, cadence)) return 'recent'
  return null
}

/** Jobs new since `since` (their last email, else a week or a day ago). */
export function weeklySince(lastWeeklyAt: Date | null, now: Date, cadence: Cadence = 'weekly'): Date {
  return lastWeeklyAt ?? new Date(now.getTime() - (cadence === 'daily' ? DAY : 7 * DAY))
}

/** A send before this is old enough to send again. */
export const sendCutoff = (now: Date, cadence: Cadence = 'weekly') => new Date(now.getTime() - (cadence === 'daily' ? DAILY_GAP_HOURS * HOUR : WEEKLY_GAP_DAYS * DAY))

export interface CandidateMatch {
  id: string
  rank: number
  score: number
  related: string[]
  dismissedAt: Date | null
  applicationId: string | null
  job: { title: string; company: string; firstSeenAt: Date; closedAt: Date | null }
}

/** The best new open jobs, one per title+company, never ones they dismissed or already tailored. */
export function pickWeeklyJobs<T extends CandidateMatch>(matches: T[], since: Date, take = WEEKLY_JOBS): T[] {
  const seen = new Set<string>()
  return matches
    .filter((m) => !m.dismissedAt && !m.applicationId && !m.job.closedAt && m.job.firstSeenAt >= since && (m.score > 0 || m.related.length > 0))
    .sort((a, b) => b.rank - a.rank || b.score - a.score)
    .filter((m) => {
      const key = `${m.job.title.toLowerCase().trim()}|${m.job.company.toLowerCase().trim()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, take)
}

export const firstName = (name: string | null | undefined): string | null => {
  const first = name?.trim().split(/\s+/)[0]
  return first && first.length <= 30 ? first : null
}
