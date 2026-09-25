// Per-user daily ceilings (server only), Pro included. Counts today's (UTC) events of the
// matching name, so there's no counter to keep in sync: the event a route already writes
// on success is the count. Parses count failures too (resume_parsed has ok: false),
// since a failed parse still costs a model call.
//
// Fails open: if the events table can't be read (not migrated yet, DB blip), the user
// gets through. The in-memory rate limit and the monthly FREE limits still apply.
import { prisma } from '@/lib/prisma'
import { DAILY_CEILINGS, dailyCeilingMessage, type DailyCeilingKind } from '@/lib/plans'
import type { EventName } from '@/lib/track'

export const CEILING_EVENTS: Record<DailyCeilingKind, EventName> = {
  tailor: 'tailored',
  coverLetter: 'cover_letter_generated',
  parse: 'resume_parsed',
}

export function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export interface DailyCeiling {
  allowed: boolean
  used: number
  limit: number
  message: string
}

export async function checkDailyCeiling(userId: string, kind: DailyCeilingKind, now = new Date()): Promise<DailyCeiling> {
  const limit = DAILY_CEILINGS[kind]
  let used = 0
  try {
    used = await prisma.event.count({
      where: { userId, name: CEILING_EVENTS[kind], createdAt: { gte: startOfUtcDay(now) } },
    })
  } catch (error) {
    console.error(`[daily-ceiling] couldn't count ${kind}, letting it through:`, (error as Error)?.message)
  }
  return { allowed: used < limit, used, limit, message: dailyCeilingMessage(kind) }
}
