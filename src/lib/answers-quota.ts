// FREE's monthly application answers (server only). Counted from this UTC month's
// application_answer events, like the daily ceilings: no counter column to migrate.
// Fails open if the events table can't be read; the daily ceiling and AI cap still apply.
import { prisma } from '@/lib/prisma'
import { FREE_ANSWERS_PER_MONTH } from '@/lib/plans'

export interface AnswersQuota {
  isPro: boolean
  used: number
  limit: number | null // null = unlimited (Pro)
  remaining: number | null
}

export async function getAnswersQuota(userId: string, isPro: boolean, now = new Date()): Promise<AnswersQuota> {
  if (isPro) return { isPro, used: 0, limit: null, remaining: null }
  let used = 0
  try {
    used = await prisma.event.count({
      where: { userId, name: 'application_answer', createdAt: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) } },
    })
  } catch (error) {
    console.error('[answers-quota] could not count, letting it through:', (error as Error)?.message)
  }
  return { isPro, used, limit: FREE_ANSWERS_PER_MONTH, remaining: Math.max(0, FREE_ANSWERS_PER_MONTH - used) }
}
