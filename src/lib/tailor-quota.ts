// Monthly tailor metering (server only).
import { prisma } from '@/lib/prisma'
import { tailorLimitFor, type PlanName } from '@/lib/plans'

export interface TailorQuota {
  plan: PlanName
  used: number
  limit: number // Infinity for PREMIUM
  remaining: number
  allowed: boolean
}

function isNewMonth(resetAt: Date, now = new Date()): boolean {
  return now.getUTCFullYear() !== resetAt.getUTCFullYear() || now.getUTCMonth() !== resetAt.getUTCMonth()
}

export async function getTailorQuota(userId: string): Promise<TailorQuota> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, monthlyTailors: true, tailorsResetAt: true },
  })
  if (!user) throw new Error('User not found')

  const used = isNewMonth(user.tailorsResetAt) ? 0 : user.monthlyTailors
  const limit = tailorLimitFor(user.plan)
  return {
    plan: user.plan,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    allowed: used < limit,
  }
}

/** Call only after a tailor result has been saved. */
export async function incrementTailorCount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tailorsResetAt: true },
  })
  if (!user) return

  if (isNewMonth(user.tailorsResetAt)) {
    await prisma.user.update({
      where: { id: userId },
      data: { monthlyTailors: 1, tailorsResetAt: new Date() },
    })
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { monthlyTailors: { increment: 1 } },
    })
  }
}
