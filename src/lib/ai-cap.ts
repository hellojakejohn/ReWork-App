// AI cap, server side: where a user stands this period, and the scope every AI route runs
// its model calls in. The rules live in src/lib/ai-cap-rules.ts.
//
// Usage per route:
//   const ai = await getAIBudget(userId)
//   if (ai.state.band === 'paused') return 429 with ai.pausedMessage
//   const { run, usage } = collectUsage(fn, ai.scope)   // routes plan tasks, logs ai_call events
//   ...
//   await ai.settle(usage().costUsd)                     // writes the 75% / 100% events
//
// Spend is the sum of costUsd on this user's ai_call events since the period started.
// Fails open like the daily ceilings: if events can't be read, spend counts as 0.
import { prisma } from '@/lib/prisma'
import { getAccess } from '@/lib/entitlements'
import { track } from '@/lib/track'
import type { UsageRecord, UsageScope } from '@/lib/ai-usage'
import { modelLabel } from '@/lib/ai/models'
import { downgradeAvailable, freeTierRoute, proAlwaysTopModel, type PlanTier } from '@/lib/ai/routing'
import {
  aiCapRatio,
  capPeriod,
  capState,
  crossedBands,
  downgradeBanner,
  pausedMessage,
  type CapPeriod,
  type CapState,
} from '@/lib/ai-cap-rules'
import type { EntitlementSource, EntitlementStatus } from '@/lib/entitlement-rules'

export async function spentUsd(userId: string, since: Date): Promise<number> {
  try {
    const rows = await prisma.$queryRaw<{ spent: number }[]>`
      SELECT COALESCE(SUM((props->>'costUsd')::numeric), 0)::float8 AS spent
      FROM "events"
      WHERE "userId" = ${userId} AND name = 'ai_call' AND "createdAt" >= ${since}`
    return Number(rows[0]?.spent ?? 0)
  } catch (error) {
    console.error('[ai-cap] could not read spend, counting it as 0:', (error as Error)?.message)
    return 0
  }
}

export async function capOverrideUsd(userId: string): Promise<number | null> {
  try {
    const row = await prisma.aiCapOverride.findUnique({ where: { userId }, select: { capUsd: true } })
    return row?.capUsd ?? null
  } catch {
    return null // table not migrated yet
  }
}

export async function userCapPeriod(userId: string, now = new Date()): Promise<CapPeriod> {
  const rows = await prisma.entitlement.findMany({
    where: { userId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
    select: { source: true, status: true, startsAt: true, endsAt: true, cancelAtPeriodEnd: true, pastDueAt: true },
  })
  return capPeriod(rows as { source: EntitlementSource; status: EntitlementStatus; startsAt: Date; endsAt: Date | null; cancelAtPeriodEnd: boolean; pastDueAt: Date | null }[], now)
}

export async function getCapState(userId: string, now = new Date()): Promise<CapState> {
  const period = await userCapPeriod(userId, now)
  const [spent, override] = await Promise.all([spentUsd(userId, period.start), capOverrideUsd(userId)])
  return capState({
    period,
    spentUsd: spent,
    ratio: aiCapRatio(),
    overrideUsd: override,
    proAlwaysTopModel: proAlwaysTopModel(),
    downgradeAvailable: downgradeAvailable(),
  })
}

export interface AIBudget {
  state: CapState
  tier: PlanTier
  scope: UsageScope
  pausedMessage: string
  /** Waits for the ai_call events, then logs any band this request crossed. */
  settle: (addedUsd: number) => Promise<void>
}

/** Logs one ai_call event per provider call: the source of truth for spend. */
function logCall(userId: string, record: UsageRecord): Promise<void> {
  return track(
    'ai_call',
    {
      provider: record.provider,
      model: record.model,
      task: record.task,
      tokensIn: record.tokensIn,
      tokensOut: record.tokensOut,
      cachedIn: record.cachedIn,
      cacheWrite: record.cacheWrite,
      costUsd: record.costUsd,
      ms: record.ms,
      ok: record.ok,
    },
    userId
  )
}

export async function getAIBudget(userId: string, now = new Date()): Promise<AIBudget> {
  const [state, access] = await Promise.all([getCapState(userId, now), getAccess(userId, now)])
  const tier: PlanTier = access.isPro ? 'pro' : 'free'
  const pending: Promise<void>[] = []
  return {
    state,
    tier,
    scope: {
      routing: { tier, downgraded: state.downgraded },
      onCall: (record) => {
        pending.push(logCall(userId, record))
      },
    },
    pausedMessage: pausedMessage(state.period.resetAt),
    settle: async (addedUsd: number) => {
      await Promise.all(pending)
      for (const band of crossedBands(state, addedUsd)) {
        await track('ai_cap_band', { band, period: state.period.kind, percent: band === 'paused' ? 100 : 75 }, userId)
      }
    },
  }
}

export interface UsageDTO {
  percent: number
  band: CapState['band']
  resetAt: string
  downgraded: boolean
  banner: string | null // the 75% band's header line, when it actually changed the model
  pausedMessage: string | null
}

/** What the client sees: a percent and dates, never dollars. */
export function usageDTO(state: CapState): UsageDTO {
  const free = freeTierRoute()
  return {
    percent: state.percent,
    band: state.band,
    resetAt: state.period.resetAt.toISOString(),
    downgraded: state.downgraded,
    banner: state.downgraded && free ? downgradeBanner(modelLabel(free.model), state.period.resetAt) : null,
    pausedMessage: state.band === 'paused' ? pausedMessage(state.period.resetAt) : null,
  }
}

/** JSON body for a request refused because the AI cap is used up (send with status 429). */
export function aiPausedBody(ai: AIBudget) {
  return { success: false, error: ai.pausedMessage, aiPaused: true, resetAt: ai.state.period.resetAt.toISOString() }
}

/** The pause check every AI route runs first. Returns the 429 body, or null to go ahead. */
export async function aiPausedCheck(ai: AIBudget, userId: string, feature: string) {
  if (ai.state.band !== 'paused') return null
  await track('limit_hit', { kind: 'ai_cap', feature, period: ai.state.period.kind }, userId)
  return aiPausedBody(ai)
}
