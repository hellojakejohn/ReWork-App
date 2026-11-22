// Who gets the weekly email and which jobs go in it. Pure: no DB, no env.

export const WEEKLY_JOBS = 5
/** Sent at most once in this many days (the cron runs several times each Monday). */
export const WEEKLY_GAP_DAYS = 6
/** Only people who used ReWork in this many days. */
export const ACTIVE_DAYS = 90
const DAY = 86_400_000

export type SkipReason = 'off' | 'unsubscribed' | 'no_email' | 'inactive' | 'recent' | 'prefs_unreadable'

export function weeklySkipReason(
  u: { email: string | null; prefs: { weekly: boolean; lastWeeklyAt: Date | null; unsubscribedAt: Date | null } | null; lastActiveAt: Date | null },
  now: Date
): SkipReason | null {
  if (!u.email) return 'no_email'
  if (!u.prefs) return 'prefs_unreadable'
  if (u.prefs.unsubscribedAt) return 'unsubscribed'
  if (!u.prefs.weekly) return 'off'
  if (!u.lastActiveAt || now.getTime() - u.lastActiveAt.getTime() > ACTIVE_DAYS * DAY) return 'inactive'
  if (u.prefs.lastWeeklyAt && now.getTime() - u.prefs.lastWeeklyAt.getTime() < WEEKLY_GAP_DAYS * DAY) return 'recent'
  return null
}

/** Jobs new since `since` (their last email, else a week ago). */
export function weeklySince(lastWeeklyAt: Date | null, now: Date): Date {
  return lastWeeklyAt ?? new Date(now.getTime() - 7 * DAY)
}

export const sendCutoff = (now: Date) => new Date(now.getTime() - WEEKLY_GAP_DAYS * DAY)

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
