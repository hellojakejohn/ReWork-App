// AI cap: revenue-linked, per period. Every band, monthly vs pass, the model switch, the
// override, and the server side with a mocked database.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  entitlements: [] as any[],
  spent: 0,
  override: null as number | null,
  events: [] as any[],
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    entitlement: { findMany: vi.fn(async () => db.entitlements) },
    aiCapOverride: { findUnique: vi.fn(async () => (db.override === null ? null : { capUsd: db.override })) },
    $queryRaw: vi.fn(async () => [{ spent: db.spent }]),
    event: { create: vi.fn(async (args: any) => db.events.push(args.data)) },
  },
}))

import {
  aiCapRatio,
  bandFor,
  capPeriod,
  capState,
  capUsd,
  crossedBands,
  downgradeBanner,
  FREE_CAP_USD,
  netRevenueUsd,
  oneMonthBefore,
  pausedMessage,
} from '@/lib/ai-cap-rules'
import { getAIBudget, usageDTO } from '@/lib/ai-cap'
import { collectUsage, recordUsage, usageRecord } from '@/lib/ai-usage'
import { resolveRoute } from '@/lib/ai/routing'

const now = new Date('2026-10-15T12:00:00Z')
const day = 24 * 60 * 60 * 1000
const at = (d: number) => new Date(now.getTime() + d * day)
const row = (o: Partial<any>): any => ({ source: 'STRIPE_SUBSCRIPTION', status: 'ACTIVE', startsAt: at(-200), endsAt: at(10), cancelAtPeriodEnd: false, pastDueAt: null, ...o })

describe('net revenue and caps', () => {
  it('nets out Stripe (2.9% + $0.30) and applies the 0.70 ratio', () => {
    expect(netRevenueUsd(15)).toBe(14.27)
    expect(netRevenueUsd(29)).toBe(27.86)
    const monthly = capPeriod([row({})], now)
    const pass = capPeriod([row({ source: 'STRIPE_PASS', startsAt: at(-5), endsAt: at(85) })], now)
    expect(capUsd(monthly)).toBe(9.99) // about $9.99 per monthly period
    expect(capUsd(pass)).toBe(19.5) // about $19.50 for the whole 90-day window
    expect(capUsd(capPeriod([], now))).toBe(FREE_CAP_USD)
    expect(FREE_CAP_USD).toBe(0.25)
  })

  it('reads AI_CAP_RATIO, ignoring nonsense', () => {
    expect(aiCapRatio(undefined)).toBe(0.7)
    expect(aiCapRatio('0.5')).toBe(0.5)
    expect(aiCapRatio('7')).toBe(0.7)
    expect(aiCapRatio('abc')).toBe(0.7)
    expect(capUsd(capPeriod([row({})], now), 0.5)).toBe(7.14) // 0.5 x 14.27, rounded to cents
  })

  it('an admin override wins, including 0', () => {
    const p = capPeriod([row({})], now)
    expect(capUsd(p, 0.7, 25)).toBe(25)
    expect(capUsd(p, 0.7, 0)).toBe(0)
    expect(capUsd(p, 0.7, null)).toBe(9.99)
  })
})

describe('cap periods and reset timing', () => {
  it('Pro Monthly: the current subscription period, resetting at its end', () => {
    const p = capPeriod([row({ endsAt: new Date('2026-10-28T00:00:00Z') })], now)
    expect(p).toMatchObject({ kind: 'monthly', resetAt: new Date('2026-10-28T00:00:00Z') })
    expect(p.start.toISOString()).toBe('2026-09-28T00:00:00.000Z')
  })

  it('Job Hunt Pass: ONE window for all 90 days, not per 30', () => {
    const p = capPeriod([row({ source: 'STRIPE_PASS', startsAt: at(-60), endsAt: at(30) })], now)
    expect(p).toMatchObject({ kind: 'pass', start: at(-60), resetAt: at(30) })
  })

  it('stacked passes: the live window counts, the next one starts fresh', () => {
    const rows = [row({ source: 'STRIPE_PASS', startsAt: at(-80), endsAt: at(10) }), row({ source: 'STRIPE_PASS', startsAt: at(10), endsAt: at(100) })]
    expect(capPeriod(rows, now)).toMatchObject({ start: at(-80), resetAt: at(10) })
    expect(capPeriod(rows, at(11))).toMatchObject({ start: at(10), resetAt: at(100) })
  })

  it('a subscription still in its pass trial falls back to the pass window', () => {
    const rows = [row({ startsAt: at(-1), endsAt: at(60) }), row({ source: 'STRIPE_PASS', startsAt: at(-30), endsAt: at(60) })]
    expect(capPeriod(rows, now).kind).toBe('pass')
  })

  it('FREE and comps reset on the calendar month', () => {
    expect(capPeriod([], now)).toMatchObject({ kind: 'free', start: new Date('2026-10-01T00:00:00Z'), resetAt: new Date('2026-11-01T00:00:00Z') })
    expect(capPeriod([row({ source: 'COMP', endsAt: at(100) })], now)).toMatchObject({ kind: 'comp', resetAt: new Date('2026-11-01T00:00:00Z') })
  })

  it('oneMonthBefore clamps month ends', () => {
    expect(oneMonthBefore(new Date('2026-03-31T10:00:00Z')).toISOString()).toBe('2026-02-28T10:00:00.000Z')
  })
})

describe('bands', () => {
  const monthly = capPeriod([row({})], now)
  const state = (spent: number, extra: Partial<Parameters<typeof capState>[0]> = {}) =>
    capState({ period: monthly, spentUsd: spent, downgradeAvailable: true, ...extra })

  it('under 75%: normal, no downgrade', () => {
    expect(state(7.49)).toMatchObject({ band: 'normal', downgraded: false, percent: 75 }) // 74.97% rounds up for display only
    expect(bandFor(0.7499)).toBe('normal')
  })

  it('75-100%: paid calls switch to the free tier', () => {
    const s = state(7.5)
    expect(s).toMatchObject({ band: 'downgrade', downgraded: true })
    expect(state(9.98).band).toBe('downgrade')
  })

  it('100%: paused', () => {
    expect(state(9.99)).toMatchObject({ band: 'paused', percent: 100 })
    expect(state(50).percent).toBe(100)
  })

  it('AI_PRO_ALWAYS_OPUS keeps the top model at 75% but still pauses at 100%', () => {
    expect(state(8, { proAlwaysTopModel: true })).toMatchObject({ band: 'downgrade', downgraded: false })
    expect(state(10, { proAlwaysTopModel: true }).band).toBe('paused')
  })

  it('no switch when no lighter model is configured', () => {
    expect(state(8, { downgradeAvailable: false }).downgraded).toBe(false)
  })

  it('FREE: pauses at the $0.25 backstop, never "downgrades" (already on the free tier)', () => {
    const free = capPeriod([], now)
    expect(capState({ period: free, spentUsd: 0.2, downgradeAvailable: true })).toMatchObject({ band: 'downgrade', downgraded: false, isPaid: false })
    expect(capState({ period: free, spentUsd: 0.25 }).band).toBe('paused')
  })

  it('a $0 override pauses on the first cent', () => {
    expect(capState({ period: monthly, spentUsd: 0, overrideUsd: 0 }).band).toBe('normal')
    expect(capState({ period: monthly, spentUsd: 0.01, overrideUsd: 0 }).band).toBe('paused')
  })

  it('reports the bands a request crossed', () => {
    expect(crossedBands(state(7), 0.6)).toEqual(['downgrade'])
    expect(crossedBands(state(7), 5)).toEqual(['downgrade', 'paused'])
    expect(crossedBands(state(8), 0.5)).toEqual([])
    expect(crossedBands(state(9.9), 0.2)).toEqual(['paused'])
  })

  it('user-facing copy has dates, never dollars', () => {
    const reset = new Date('2026-11-01T00:00:00Z')
    expect(downgradeBanner('Sonnet 5.5', reset)).toBe('High usage this month: running on Sonnet 5.5 until Nov 1.')
    expect(pausedMessage(reset)).toMatch(/paused until Nov 1\. Downloads, the tracker and editing still work/)
    expect(pausedMessage(reset)).not.toMatch(/\$/)
  })
})

describe('getAIBudget (server, mocked db)', () => {
  const KEYS = ['ANTHROPIC_API_KEY', 'AI_FREE_TIER', 'AI_TAILOR', 'AI_PRO_ALWAYS_OPUS', 'AI_CAP_RATIO']
  let saved: Record<string, string | undefined>
  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))
    for (const k of KEYS) delete process.env[k]
    process.env.ANTHROPIC_API_KEY = 'k'
    process.env.AI_FREE_TIER = 'anthropic:claude-sonnet-5-5'
    db.entitlements = [row({ endsAt: new Date(Date.now() + 10 * day), startsAt: new Date(Date.now() - 100 * day) })]
    db.spent = 0
    db.override = null
    db.events = []
  })
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it('Pro under 75% routes to Opus; at 75% to Sonnet with a banner; at 100% pauses', async () => {
    db.spent = 1
    let ai = await getAIBudget('u1')
    expect(ai.tier).toBe('pro')
    expect(resolveRoute('tailor', ai.scope.routing).model).toBe('claude-opus-5-5')
    expect(usageDTO(ai.state)).toMatchObject({ band: 'normal', banner: null })

    db.spent = 8
    ai = await getAIBudget('u1')
    expect(resolveRoute('tailor', ai.scope.routing).model).toBe('claude-sonnet-5-5')
    expect(resolveRoute('parse', ai.scope.routing).model).toBe('claude-opus-5-5')
    const dto = usageDTO(ai.state)
    expect(dto.banner).toMatch(/^High usage this month: running on Sonnet 5\.5 until /)
    expect(JSON.stringify(dto)).not.toMatch(/capUsd|spent|\$/)

    db.spent = 10
    ai = await getAIBudget('u1')
    expect(ai.state.band).toBe('paused')
    expect(usageDTO(ai.state).pausedMessage).toMatch(/paused until/)
  })

  it('AI_PRO_ALWAYS_OPUS=true keeps Opus at 75%', async () => {
    process.env.AI_PRO_ALWAYS_OPUS = 'true'
    db.spent = 8
    const ai = await getAIBudget('u1')
    expect(resolveRoute('tailor', ai.scope.routing).model).toBe('claude-opus-5-5')
    expect(usageDTO(ai.state).banner).toBeNull()
  })

  it('the admin override changes the band', async () => {
    db.spent = 8
    db.override = 100
    expect((await getAIBudget('u1')).state.band).toBe('normal')
    db.override = 1
    expect((await getAIBudget('u1')).state.band).toBe('paused')
  })

  it('logs one ai_call event per call and the 75% / 100% crossings once', async () => {
    db.spent = 7
    const ai = await getAIBudget('u1')
    const { run, usage } = collectUsage(async () => {
      recordUsage(usageRecord('anthropic', 'claude-opus-5-5', { inputTokens: 100_000, outputTokens: 200_000, cachedInputTokens: 0 }, { task: 'tailor' }))
    }, ai.scope)
    await run
    await ai.settle(usage().costUsd) // $4.40 on top of $7: crosses 75% and 100% of $9.99
    const calls = db.events.filter((e) => e.name === 'ai_call')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ userId: 'u1', props: { provider: 'anthropic', model: 'claude-opus-5-5', task: 'tailor', costUsd: 4.4 } })
    expect(db.events.filter((e) => e.name === 'ai_cap_band').map((e) => e.props.band)).toEqual(['downgrade', 'paused'])
  })

  it('FREE users get the free tier and the flat backstop', async () => {
    db.entitlements = []
    db.spent = 0.1
    const ai = await getAIBudget('u2')
    expect(ai.tier).toBe('free')
    expect(ai.state.capUsd).toBe(0.25)
    expect(resolveRoute('coverLetter', ai.scope.routing).model).toBe('claude-sonnet-5-5')
  })
})
