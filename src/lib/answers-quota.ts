// FREE's monthly allowance for features counted from events (server only): application
// answers and interview prep. Counted from this UTC month's events, like the daily
// ceilings, so there's no counter column to migrate. Fails open if the events table can't
// be read; the daily ceiling and the AI cap still apply.
import { prisma } from '@/lib/prisma'
import { FREE_ANSWERS_PER_MONTH, FREE_INTERVIEW_PREPS_PER_MONTH } from '@/lib/plans'
import type { EventName } from '@/lib/track'

export interface EventQuota {
  isPro: boolean
  used: number
  limit: number | null // null = unlimited (Pro)
  remaining: number | null
}
export type AnswersQuota = EventQuota

export async function getEventQuota(userId: string, isPro: boolean, event: EventName, freeLimit: number, now = new Date()): Promise<EventQuota> {
  if (isPro) return { isPro, used: 0, limit: null, remaining: null }
  let used = 0
  try {
    used = await prisma.event.count({
      where: { userId, name: event, createdAt: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) } },
    })
  } catch (error) {
    console.error(`[event-quota] could not count ${event}, letting it through:`, (error as Error)?.message)
  }
  return { isPro, used, limit: freeLimit, remaining: Math.max(0, freeLimit - used) }
}

export const getAnswersQuota = (userId: string, isPro: boolean) => getEventQuota(userId, isPro, 'application_answer', FREE_ANSWERS_PER_MONTH)
export const getInterviewPrepQuota = (userId: string, isPro: boolean) => getEventQuota(userId, isPro, 'interview_prep', FREE_INTERVIEW_PREPS_PER_MONTH)

/** The quota after one more use. */
export function afterUse(q: EventQuota): EventQuota {
  return q.remaining === null ? q : { ...q, used: q.used + 1, remaining: Math.max(0, q.remaining - 1) }
}
