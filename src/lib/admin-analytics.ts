// The admin page's numbers (server only), all from the events and entitlements tables.
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { PRICING } from '@/lib/plans'
import type { EventName } from '@/lib/track'

export type WindowDays = 7 | 30
export const isWindowDays = (v: number): v is WindowDays => v === 7 || v === 30

export interface FunnelStep {
  label: string
  users: number
  pctOfStart: number | null // null when the cohort is empty
  pctOfPrevious: number | null
}

export interface AnalyticsReport {
  days: WindowDays
  since: string
  counts: Record<string, number>
  funnel: FunnelStep[]
  recentErrors: { at: string; name: string; feature: string; kind: string; ms: number | null }[]
  errorsByKind: { feature: string; kind: string; count: number }[]
  spendByDay: { day: string; calls: number; tokensIn: number; tokensOut: number; costUsd: number }[]
  spendTotalUsd: number
  pro: { activeUsers: number; subscriptions: number; passes: number; comps: number; mrrUsd: number; passRevenue30dUsd: number }
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null)

/** Pure: turn per-step user counts into a funnel with conversion percentages. */
export function buildFunnel(steps: { label: string; users: number }[]): FunnelStep[] {
  const start = steps[0]?.users ?? 0
  return steps.map((step, i) => ({
    ...step,
    pctOfStart: pct(step.users, start),
    pctOfPrevious: i === 0 ? pct(step.users, start) : pct(step.users, steps[i - 1].users),
  }))
}

const dollars = (amount: string) => Number(amount.replace(/[^0-9.]/g, '')) || 0

type Props = Record<string, unknown> | null

// Funnel steps after sign-up. Cohort funnel: of the users who signed up in the window,
// how many ever did each step (a step can happen after the window ends).
const FUNNEL_STEPS: { label: string; name: EventName; where?: Prisma.JsonFilter<'Event'> }[] = [
  { label: 'Parsed a resume', name: 'resume_parsed', where: { path: ['ok'], equals: true } },
  { label: 'Tailored', name: 'tailored' },
  { label: 'Hit a limit', name: 'limit_hit' },
  { label: 'Started checkout', name: 'checkout_started' },
  { label: 'Paid', name: 'checkout_completed' },
]

export async function analyticsReport(days: WindowDays, now = new Date()): Promise<AnalyticsReport> {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const inWindow = { createdAt: { gte: since } }

  const [grouped, signups] = await Promise.all([
    prisma.event.groupBy({ by: ['name'], where: inWindow, _count: { _all: true } }),
    prisma.event.findMany({ where: { name: 'signed_up', userId: { not: null }, ...inWindow }, select: { userId: true } }),
  ])
  const counts = Object.fromEntries(grouped.map((g) => [g.name, g._count._all]))
  const cohort = [...new Set(signups.map((s) => s.userId as string))]

  const stepUsers = await Promise.all(
    FUNNEL_STEPS.map(async (step) =>
      cohort.length === 0
        ? 0
        : (
            await prisma.event.findMany({
              where: { name: step.name, userId: { in: cohort }, ...(step.where ? { props: step.where } : {}) },
              distinct: ['userId'],
              select: { userId: true },
            })
          ).length
    )
  )
  const funnel = buildFunnel([{ label: 'Signed up', users: cohort.length }, ...FUNNEL_STEPS.map((s, i) => ({ label: s.label, users: stepUsers[i] }))])

  // Errors: failed parses and AI errors.
  const errorWhere: Prisma.EventWhereInput = {
    ...inWindow,
    OR: [{ name: 'ai_error' }, { name: 'resume_parsed', props: { path: ['ok'], equals: false } }],
  }
  const errors = await prisma.event.findMany({ where: errorWhere, orderBy: { createdAt: 'desc' }, take: 2000, select: { name: true, props: true, createdAt: true } })
  const describe = (e: { name: string; props: unknown }) => {
    const p = (e.props ?? {}) as Props & Record<string, unknown>
    return { feature: e.name === 'resume_parsed' ? 'parse' : String(p.feature ?? 'unknown'), kind: String(p.kind ?? 'unknown'), ms: typeof p.ms === 'number' ? p.ms : null }
  }
  const byKind = new Map<string, { feature: string; kind: string; count: number }>()
  for (const e of errors) {
    const d = describe(e)
    const key = `${d.feature}:${d.kind}`
    byKind.set(key, { feature: d.feature, kind: d.kind, count: (byKind.get(key)?.count ?? 0) + 1 })
  }

  const spendRows = await prisma.$queryRaw<{ day: string; calls: number; tokensIn: number; tokensOut: number; costUsd: number }[]>`
    SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
           COALESCE(SUM((props->>'aiCalls')::numeric), 0)::float8 AS "calls",
           COALESCE(SUM((props->>'tokensIn')::numeric), 0)::float8 AS "tokensIn",
           COALESCE(SUM((props->>'tokensOut')::numeric), 0)::float8 AS "tokensOut",
           COALESCE(SUM((props->>'costUsd')::numeric), 0)::float8 AS "costUsd"
    FROM "events"
    WHERE "createdAt" >= ${since} AND props->>'costUsd' IS NOT NULL
    GROUP BY 1
    ORDER BY 1 DESC`
  const spendByDay = spendRows.map((r) => ({ ...r, costUsd: Math.round(r.costUsd * 100) / 100 }))

  // Pro right now, from entitlements (the source of truth; User.plan is only a mirror).
  const active = await prisma.entitlement.findMany({
    where: { status: { in: ['ACTIVE', 'PAST_DUE'] }, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    select: { userId: true, source: true },
  })
  const passesSold30d = await prisma.entitlement.count({
    where: { source: 'STRIPE_PASS', createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }, status: { not: 'REFUNDED' } },
  })
  const subscriptions = active.filter((e) => e.source === 'STRIPE_SUBSCRIPTION').length

  return {
    days,
    since: since.toISOString(),
    counts,
    funnel,
    recentErrors: errors.slice(0, 25).map((e) => ({ at: e.createdAt.toISOString(), name: e.name, ...describe(e) })),
    errorsByKind: [...byKind.values()].sort((a, b) => b.count - a.count),
    spendByDay,
    spendTotalUsd: Math.round(spendByDay.reduce((s, r) => s + r.costUsd, 0) * 100) / 100,
    pro: {
      activeUsers: new Set(active.map((e) => e.userId)).size,
      subscriptions,
      passes: active.filter((e) => e.source === 'STRIPE_PASS').length,
      comps: active.filter((e) => e.source === 'COMP').length,
      mrrUsd: subscriptions * dollars(PRICING.monthly.amount),
      passRevenue30dUsd: passesSold30d * dollars(PRICING.pass.amount),
    },
  }
}
