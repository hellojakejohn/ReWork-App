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
// If events can't be read, paid users go ahead (spend counts as 0) and FREE users are
// paused until it can be read again.
//
// Two switches above every user's cap (getAIBudget):
//   AI_DISABLED=1          pauses every AI feature now (incident kill switch)
//   AI_FREE_DAILY_USD=25   pauses FREE accounts once today's (UTC) free-tier spend reaches
//                          it (default DEFAULT_FREE_DAILY_USD; 0 turns it off). Paid users
//                          never hit it: their own cap is 0.70 x what they paid, so their
//                          AI is always covered. This caps the only spend that can lose money.
//   AI_BURN_DAILY_USD=12   the same for Pro bought by burning $REWORK (Jake is paid $0 for
//                          it), shared by every burn-Pro account. Card-paid Pro never hits it.
// Every model call also takes an in-flight slot (src/lib/ai-inflight.ts), so parallel
// requests can't all slip under the cap before their spend is written.
import { prisma } from '@/lib/prisma'
import { getAccess } from '@/lib/entitlements'
import { acquireInflightSlot } from '@/lib/ai-inflight'
import { startOfUtcDay } from '@/lib/daily-ceiling'
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

/** This user's spend since `since`, or null when events can't be read. */
async function readSpend(userId: string, since: Date): Promise<number | null> {
  try {
    const rows = await prisma.$queryRaw<{ spent: number }[]>`
      SELECT COALESCE(SUM((props->>'costUsd')::numeric), 0)::float8 AS spent
      FROM "events"
      WHERE "userId" = ${userId} AND name = 'ai_call' AND "createdAt" >= ${since}`
    return Number(rows[0]?.spent ?? 0)
  } catch (error) {
    console.error('[ai-cap] could not read spend:', (error as Error)?.message)
    return null
  }
}

export async function spentUsd(userId: string, since: Date): Promise<number> {
  return (await readSpend(userId, since)) ?? 0
}

// AI routes run with maxDuration 300; leave 20s to save the result and answer.
const AI_ROUTE_BUDGET_MS = 280_000

export const DEFAULT_FREE_DAILY_USD = 25
export const DEFAULT_BURN_DAILY_USD = 12
const GLOBAL_CACHE_MS = 60_000
const globalCache = new Map<SpendTier, { day: number; at: number; spent: number }>()

/** Who pays for a call: 'burn' is Pro whose current cap period comes from a burn. */
export type SpendTier = 'free' | 'pro' | 'burn'

export const AI_DISABLED_MESSAGE =
  "rework's AI features are paused for a few minutes while we fix something. Downloads, the tracker and editing still work."
export const AI_FREE_CEILING_MESSAGE =
  "rework's free plan has used today's AI allowance, so AI for free accounts is back at midnight UTC. Go Pro to keep going now. Downloads, the tracker and editing still work."
export const AI_BURN_CEILING_MESSAGE =
  "Pro from burned $REWORK has used today's AI allowance, so it's back at midnight UTC. Downloads, the tracker and editing still work."
export const AI_SPEND_UNKNOWN_MESSAGE = "We can't check your AI usage right now. Please try again in a few minutes."

function dailyUsd(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback
  const value = Number(raw.trim())
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

export function freeDailyCeilingUsd(): number {
  return dailyUsd(process.env.AI_FREE_DAILY_USD, DEFAULT_FREE_DAILY_USD)
}

export function burnDailyCeilingUsd(): number {
  return dailyUsd(process.env.AI_BURN_DAILY_USD, DEFAULT_BURN_DAILY_USD)
}

/**
 * Today's (UTC) AI spend by one tier, cached for a minute per instance. Null if
 * unreadable. Calls logged without a tier count as free (the conservative side).
 */
async function tierSpentToday(tier: SpendTier, now: Date): Promise<number | null> {
  const day = startOfUtcDay(now).getTime()
  const cached = globalCache.get(tier)
  if (cached && cached.day === day && now.getTime() - cached.at < GLOBAL_CACHE_MS) return cached.spent
  try {
    const rows = await prisma.$queryRaw<{ spent: number }[]>`
      SELECT COALESCE(SUM((props->>'costUsd')::numeric), 0)::float8 AS spent
      FROM "events"
      WHERE name = 'ai_call' AND "createdAt" >= ${new Date(day)} AND COALESCE(props->>'tier', 'free') = ${tier}`
    const spent = Number(rows[0]?.spent ?? 0)
    globalCache.set(tier, { day, at: now.getTime(), spent })
    return spent
  } catch (error) {
    console.error(`[ai-cap] could not read ${tier}-tier spend:`, (error as Error)?.message)
    return null
  }
}

/** Why this tier's AI is paused for everyone right now (kill switch, daily ceiling), or null. */
export async function globalAIBlock(tier: SpendTier, now = new Date()): Promise<string | null> {
  if (/^(1|true|yes)$/i.test(process.env.AI_DISABLED?.trim() || '')) return AI_DISABLED_MESSAGE
  if (tier === 'pro') return null
  const ceiling = tier === 'free' ? freeDailyCeilingUsd() : burnDailyCeilingUsd()
  if (ceiling === 0) return null
  const spent = await tierSpentToday(tier, now)
  // Unreadable: FREE goes ahead (each FREE user's own cap fails closed; the Anthropic limit
  // backs it). Burn fails closed here: it has no revenue behind it at all.
  if (spent === null) return tier === 'burn' ? AI_SPEND_UNKNOWN_MESSAGE : null
  if (spent >= ceiling) {
    console.error(`[ai-cap] ${tier.toUpperCase()}_CEILING reached: $${spent.toFixed(2)} of $${ceiling} today; AI paused for ${tier} accounts`)
    return tier === 'free' ? AI_FREE_CEILING_MESSAGE : AI_BURN_CEILING_MESSAGE
  }
  return null
}

/** Test hook: forget the cached global spend. */
export function resetGlobalSpendCache() {
  globalCache.clear()
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
  return (await capStateWithReadStatus(userId, now)).state
}

async function capStateWithReadStatus(userId: string, now: Date): Promise<{ state: CapState; spendUnknown: boolean }> {
  const period = await userCapPeriod(userId, now)
  const [spent, override] = await Promise.all([readSpend(userId, period.start), capOverrideUsd(userId)])
  const state = capState({
    period,
    spentUsd: spent ?? 0,
    ratio: aiCapRatio(),
    overrideUsd: override,
    proAlwaysTopModel: proAlwaysTopModel(),
    downgradeAvailable: downgradeAvailable(),
  })
  return { state, spendUnknown: spent === null }
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
function logCall(userId: string, tier: SpendTier, record: UsageRecord): Promise<void> {
  return track(
    'ai_call',
    {
      tier,
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
  const [capRead, access] = await Promise.all([capStateWithReadStatus(userId, now), getAccess(userId, now)])
  const tier: PlanTier = access.isPro ? 'pro' : 'free'
  const spend: SpendTier = !access.isPro ? 'free' : capRead.state.period.kind === 'burn' ? 'burn' : 'pro'
  const globalBlock = await globalAIBlock(spend, now)
  // FREE fails closed when its spend can't be read; paid users go ahead.
  const block = globalBlock ?? (capRead.spendUnknown && tier === 'free' ? AI_SPEND_UNKNOWN_MESSAGE : null)
  const state: CapState = block ? { ...capRead.state, band: 'paused' } : capRead.state
  const pending: Promise<void>[] = []
  return {
    state,
    tier,
    scope: {
      routing: { tier, downgraded: state.downgraded },
      onCall: (record) => {
        pending.push(logCall(userId, spend, record))
      },
      slot: () => acquireInflightSlot(userId),
      deadline: Date.now() + AI_ROUTE_BUDGET_MS,
    },
    pausedMessage: block ?? pausedMessage(state.period.resetAt),
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

export interface AdminCapRow {
  mtdSpendUsd: number // calendar month to date
  periodSpendUsd: number // since the cap period started
  capUsd: number
  percent: number
  band: CapState['band']
  period: CapPeriod['kind']
  resetAt: string
  overrideUsd: number | null
}

/** Admin users table: every user's AI spend and cap, in three queries. */
export async function adminCapRows(userIds: string[], now = new Date()): Promise<Record<string, AdminCapRow>> {
  if (userIds.length === 0) return {}
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const [entitlements, overrides, calls] = await Promise.all([
    prisma.entitlement.findMany({
      where: { userId: { in: userIds }, status: { in: ['ACTIVE', 'PAST_DUE'] } },
      select: { userId: true, source: true, status: true, startsAt: true, endsAt: true, cancelAtPeriodEnd: true, pastDueAt: true },
    }),
    prisma.aiCapOverride.findMany({ where: { userId: { in: userIds } }, select: { userId: true, capUsd: true } }).catch(() => []),
    // Every ai_call since the earliest possible period start (a pass window is 90 days,
    // stacked passes start later, so 100 days back covers it).
    prisma.$queryRaw<{ userId: string; createdAt: Date; costUsd: number }[]>`
      SELECT "userId", "createdAt", COALESCE((props->>'costUsd')::float8, 0) AS "costUsd"
      FROM "events"
      WHERE name = 'ai_call' AND "userId" IS NOT NULL AND "createdAt" >= ${new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000)}`.catch(() => []),
  ])
  const overrideBy = new Map(overrides.map((o) => [o.userId, o.capUsd]))
  const out: Record<string, AdminCapRow> = {}
  for (const id of userIds) {
    const period = capPeriod(
      entitlements.filter((e) => e.userId === id) as Parameters<typeof capPeriod>[0],
      now
    )
    const mine = calls.filter((c) => c.userId === id)
    const sum = (since: Date) => Math.round(mine.filter((c) => c.createdAt >= since).reduce((s, c) => s + Number(c.costUsd), 0) * 10000) / 10000
    const state = capState({ period, spentUsd: sum(period.start), overrideUsd: overrideBy.get(id) ?? null, proAlwaysTopModel: proAlwaysTopModel(), downgradeAvailable: downgradeAvailable() })
    out[id] = {
      mtdSpendUsd: sum(monthStart),
      periodSpendUsd: state.spentUsd,
      capUsd: state.capUsd,
      percent: state.percent,
      band: state.band,
      period: period.kind,
      resetAt: period.resetAt.toISOString(),
      overrideUsd: overrideBy.get(id) ?? null,
    }
  }
  return out
}

/** Admin: set (number) or clear (null) a user's cap override. */
export async function setCapOverride(userId: string, capUsd: number | null, note?: string): Promise<void> {
  if (capUsd === null) {
    await prisma.aiCapOverride.deleteMany({ where: { userId } })
    return
  }
  await prisma.aiCapOverride.upsert({
    where: { userId },
    create: { userId, capUsd, note: note ?? null },
    update: { capUsd, note: note ?? null },
  })
}
