// Monthly metering (server only): tailors and cover letters. Each has a counter and a
// reset date on the user row; the counter resets on the first use in a new UTC month.
import { prisma } from '@/lib/prisma'
import { getAccess } from '@/lib/entitlements'
import { coverLetterLimitFor, tailorLimitFor } from '@/lib/plans'

export interface MonthlyQuota {
  isPro: boolean
  used: number
  limit: number // Infinity for Pro
  remaining: number
  allowed: boolean
}
export type TailorQuota = MonthlyQuota

export type MeteredFeature = 'tailor' | 'coverLetter'

const FIELDS = {
  tailor: { count: 'monthlyTailors', resetAt: 'tailorsResetAt', limitFor: tailorLimitFor },
  coverLetter: { count: 'monthlyCoverLetters', resetAt: 'coverLettersResetAt', limitFor: coverLetterLimitFor },
} as const

export function isNewMonth(resetAt: Date, now = new Date()): boolean {
  return now.getUTCFullYear() !== resetAt.getUTCFullYear() || now.getUTCMonth() !== resetAt.getUTCMonth()
}

/** Pure: what the counter means this month. */
export function quotaFrom(count: number, resetAt: Date, isPro: boolean, feature: MeteredFeature, now = new Date()): MonthlyQuota {
  const used = isNewMonth(resetAt, now) ? 0 : count
  const limit = FIELDS[feature].limitFor(isPro)
  return { isPro, used, limit, remaining: Math.max(0, limit - used), allowed: used < limit }
}

export async function getMonthlyQuota(userId: string, feature: MeteredFeature): Promise<MonthlyQuota> {
  const f = FIELDS[feature]
  const [user, access] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { [f.count]: true, [f.resetAt]: true } }),
    getAccess(userId),
  ])
  if (!user) throw new Error('User not found')
  const row = user as unknown as Record<string, number | Date>
  return quotaFrom(row[f.count] as number, row[f.resetAt] as Date, access.isPro, feature)
}

const startOfUtcMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))

export interface Reservation {
  /** Give the use back (the model call failed or nothing was saved). Safe to call twice. */
  release: () => Promise<void>
}

/**
 * Takes one use BEFORE the model call, atomically, so parallel requests can't all pass a
 * read-then-increment check. Returns null when the limit is reached. Each step is a single
 * conditional UPDATE: a new month resets the counter to 1; otherwise it increments only
 * while under the limit (Pro has no limit but is still counted).
 */
export async function reserveMonthly(userId: string, feature: MeteredFeature, isPro: boolean, now = new Date()): Promise<Reservation | null> {
  const f = FIELDS[feature]
  const monthStart = startOfUtcMonth(now)
  const limit = f.limitFor(isPro)

  let reserved = (
    await prisma.user.updateMany({
      where: { id: userId, [f.resetAt]: { lt: monthStart } },
      data: { [f.count]: 1, [f.resetAt]: now },
    })
  ).count === 1
  if (!reserved && limit > 0) {
    reserved = (
      await prisma.user.updateMany({
        where: { id: userId, [f.resetAt]: { gte: monthStart }, ...(Number.isFinite(limit) ? { [f.count]: { lt: limit } } : {}) },
        data: { [f.count]: { increment: 1 } },
      })
    ).count === 1
  }
  if (!reserved) return null

  let released = false
  return {
    release: async () => {
      if (released) return
      released = true
      await prisma.user.updateMany({
        where: { id: userId, [f.resetAt]: { gte: monthStart }, [f.count]: { gt: 0 } },
        data: { [f.count]: { decrement: 1 } },
      })
    },
  }
}

export const getTailorQuota = (userId: string) => getMonthlyQuota(userId, 'tailor')
export const getCoverLetterQuota = (userId: string) => getMonthlyQuota(userId, 'coverLetter')

/** JSON-safe quota for the client (null = unlimited). */
export function quotaDTO(q: MonthlyQuota) {
  return {
    isPro: q.isPro,
    used: q.used,
    limit: Number.isFinite(q.limit) ? q.limit : null,
    remaining: Number.isFinite(q.remaining) ? q.remaining : null,
  }
}
