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

/** Call only after the result has been saved. */
export async function incrementMonthly(userId: string, feature: MeteredFeature): Promise<void> {
  const f = FIELDS[feature]
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { [f.resetAt]: true } })
  if (!user) return
  const resetAt = (user as unknown as Record<string, Date>)[f.resetAt]
  await prisma.user.update({
    where: { id: userId },
    data: isNewMonth(resetAt) ? { [f.count]: 1, [f.resetAt]: new Date() } : { [f.count]: { increment: 1 } },
  })
}

export const getTailorQuota = (userId: string) => getMonthlyQuota(userId, 'tailor')
export const incrementTailorCount = (userId: string) => incrementMonthly(userId, 'tailor')
export const getCoverLetterQuota = (userId: string) => getMonthlyQuota(userId, 'coverLetter')
export const incrementCoverLetterCount = (userId: string) => incrementMonthly(userId, 'coverLetter')

/** JSON-safe quota for the client (null = unlimited). */
export function quotaDTO(q: MonthlyQuota) {
  return {
    isPro: q.isPro,
    used: q.used,
    limit: Number.isFinite(q.limit) ? q.limit : null,
    remaining: Number.isFinite(q.remaining) ? q.remaining : null,
  }
}
