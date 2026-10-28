// Per-user limit on model calls running at the same time (server only). The AI cap and
// the daily ceilings count spend and uses that are written after a call finishes, so
// without this a script could fire 50 calls at 99% of the cap and all 50 would pass.
// With at most AI_MAX_INFLIGHT calls in flight, the overshoot is that many calls.
//
// A slot is an `ai_inflight` row in `events`: insert first, then count, so two requests
// racing for the last slot can't both win (the loser deletes its row and is refused).
// Rows are deleted when the call ends; a row left by a killed function stops counting
// after SLOT_TTL_MS (longer than any route's maxDuration). No migration needed.
import { prisma } from '@/lib/prisma'

export const AI_MAX_INFLIGHT = 2
const SLOT_TTL_MS = 6 * 60 * 1000

/** Thrown when the user already has AI_MAX_INFLIGHT calls running. Classified as a rate limit. */
export class AIInflightError extends Error {
  status = 429
  code = 'rate_limit_error'
  constructor() {
    super('Too many AI calls in flight for this user')
    this.name = 'AIInflightError'
  }
}

/**
 * Takes a slot for one model call. Returns the release function. If the events table
 * can't be written, the call goes ahead (the AI cap and the Anthropic spend limit still apply).
 */
export async function acquireInflightSlot(userId: string, now = new Date()): Promise<() => Promise<void>> {
  let id: string
  try {
    id = (await prisma.event.create({ data: { name: 'ai_inflight', userId, props: {} }, select: { id: true } })).id
  } catch (error) {
    console.error('[ai-inflight] could not take a slot, letting the call through:', (error as Error)?.message)
    return async () => {}
  }
  const release = async () => {
    await prisma.event.deleteMany({ where: { id } }).catch(() => {})
  }
  try {
    const running = await prisma.event.count({
      where: { userId, name: 'ai_inflight', createdAt: { gte: new Date(now.getTime() - SLOT_TTL_MS) } },
    })
    if (running > AI_MAX_INFLIGHT) {
      await release()
      throw new AIInflightError()
    }
  } catch (error) {
    if (error instanceof AIInflightError) throw error
    console.error('[ai-inflight] could not count slots, letting the call through:', (error as Error)?.message)
  }
  return release
}
