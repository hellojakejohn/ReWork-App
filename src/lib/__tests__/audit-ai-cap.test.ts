// Audit (launch-audit branch): AI cap, daily ceilings and the admin override, with a mocked
// database. `it.fails` = a bug or an unguarded money path; the comment says what correct
// behavior is.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  entitlements: [] as any[],
  spent: 0,
  spentFails: false,
  countFails: false,
  writeFails: false,
  todayCount: 0,
  events: [] as any[],
  overrides: new Map<string, number>(),
  session: null as any,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    entitlement: { findMany: vi.fn(async () => db.entitlements) },
    aiCapOverride: {
      findUnique: vi.fn(async ({ where }: any) => (db.overrides.has(where.userId) ? { capUsd: db.overrides.get(where.userId) } : null)),
      upsert: vi.fn(async ({ where, create }: any) => db.overrides.set(where.userId, create.capUsd)),
      deleteMany: vi.fn(async ({ where }: any) => db.overrides.delete(where.userId)),
    },
    $queryRaw: vi.fn(async () => {
      if (db.spentFails) throw new Error('connection reset')
      return [{ spent: db.spent }]
    }),
    event: {
      create: vi.fn(async (args: any) => {
        if (db.writeFails) throw new Error('connection reset')
        db.events.push(args.data)
        if (args.data.name === 'ai_call') db.spent += Number(args.data.props.costUsd)
      }),
      count: vi.fn(async () => {
        if (db.countFails) throw new Error('connection reset')
        return db.todayCount
      }),
    },
    user: { findUnique: vi.fn(async ({ where }: any) => ({ id: where.id })) },
  },
}))
vi.mock('@/lib/entitlements', () => ({ getAccess: vi.fn(async () => ({ isPro: db.entitlements.length > 0 })) }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => db.session) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { capPeriod, capUsd, netRevenueUsd, pausedMessage } from '@/lib/ai-cap-rules'
import { getAIBudget, getCapState } from '@/lib/ai-cap'
import { collectUsage, recordUsage, usageRecord } from '@/lib/ai-usage'
import { checkDailyCeiling } from '@/lib/daily-ceiling'
import { costUsd } from '@/lib/ai/models'
import { POST as adminCapPOST } from '@/app/api/admin/users/[id]/ai-cap/route'

const now = new Date('2026-10-15T12:00:00Z')
const day = 86_400_000
const sub = { source: 'STRIPE_SUBSCRIPTION', status: 'ACTIVE', startsAt: new Date(now.getTime() - 200 * day), endsAt: new Date(now.getTime() + 10 * day), cancelAtPeriodEnd: false, pastDueAt: null }

// Worst case for one Opus call that uses its whole budget: tailor/parse ask for 8000
// answer tokens -> max_tokens 16000 (anthropicMaxTokens). ~12k input tokens (resume JSON
// + 20k-char job description + system prompt, first call writes the cache).
const OPUS_WORST_ATTEMPT = costUsd('claude-opus-5-5', { inputTokens: 7000, outputTokens: 16000, cachedInputTokens: 0, cacheWriteTokens: 5000 })

beforeEach(() => {
  Object.assign(db, { entitlements: [], spent: 0, spentFails: false, countFails: false, writeFails: false, todayCount: 0, events: [], session: null })
  db.overrides.clear()
})

describe('cap amounts', () => {
  it('FREE $0.50/month, Pro $9.99/period, Pass $19.50 per 90 days (0.70 x price - 2.9% - $0.30)', () => {
    expect(netRevenueUsd(15)).toBe(14.27)
    expect(netRevenueUsd(29)).toBe(27.86)
    expect(capUsd(capPeriod([], now))).toBe(0.5)
    expect(capUsd(capPeriod([sub as any], now))).toBe(9.99)
    expect(capUsd(capPeriod([{ ...sub, source: 'STRIPE_PASS', startsAt: now, endsAt: new Date(now.getTime() + 90 * day) } as any], now))).toBe(19.5)
  })

  it('worst-case Opus attempt is about $0.37; with the repair retry about $0.75 (1.5x the FREE cap)', () => {
    expect(OPUS_WORST_ATTEMPT).toBeCloseTo(0.373, 2)
  })

  it('100%: paused message names the reset date and says downloads/tracker keep working', () => {
    const msg = pausedMessage(new Date('2026-11-01T00:00:00Z'))
    expect(msg).toContain('Nov 1')
    expect(msg).toMatch(/Downloads, the tracker and editing still work/)
  })

  it('75%: a Pro user is downgraded; 100%: paused', async () => {
    const saved = process.env.ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test' // the downgrade needs a Sonnet route to exist
    try {
      db.entitlements = [sub]
      db.spent = 7.6
      expect((await getCapState('u', now)).downgraded).toBe(true)
      db.spent = 9.99
      expect((await getCapState('u', now)).band).toBe('paused')
    } finally {
      process.env.ANTHROPIC_API_KEY = saved
    }
  })
})

describe('fail open', () => {
  // Fixed on launch-audit: FREE fails closed when spend can't be read; paid users go ahead.
  it('events read fails -> a FREE user who is far over the cap is still paused', async () => {
    db.spent = 5
    db.spentFails = true
    const ai = await getAIBudget('u', now)
    expect(ai.state.band).toBe('paused')
  })

  it('events read fails -> a Pro user is not paused', async () => {
    db.entitlements = [sub]
    db.spentFails = true
    expect((await getAIBudget('u', now)).state.band).not.toBe('paused')
  })

  // Correct: same for the daily ceiling (20 tailors/day): today a read error lets it through.
  it.fails('events count fails -> the daily ceiling still holds', async () => {
    db.todayCount = 500
    db.countFails = true
    expect((await checkDailyCeiling('u', 'tailor', now)).allowed).toBe(false)
  })

  // Correct: a dropped ai_call write is spend the cap never sees again (track() swallows
  // the error). It should be retried, or the request after it should fail closed.
  it.fails('an ai_call write that fails is still counted toward the cap', async () => {
    db.writeFails = true
    const ai = await getAIBudget('u', now)
    const c = collectUsage(async () => recordUsage(usageRecord('anthropic', 'claude-opus-5-5', { inputTokens: 1000, outputTokens: 30000, cachedInputTokens: 0 })), ai.scope)
    await c.run
    await ai.settle(c.usage().costUsd)
    db.writeFails = false
    expect((await getCapState('u', now)).spentUsd).toBeGreaterThan(0)
  })
})

describe('races: spend is recorded only after the call', () => {
  // Still true by design: every parallel request reads the same pre-call spend. Since
  // launch-audit the overshoot is bounded at the model call instead: at most
  // AI_MAX_INFLIGHT calls per user run at once (audit-ai-inflight.test.ts).
  it.fails('N parallel requests from a FREE user at 98% of the cap: at most one is admitted', async () => {
    db.spent = 0.49
    const N = 20
    const budgets = await Promise.all(Array.from({ length: N }, () => getAIBudget('u', now)))
    const admitted = budgets.filter((b) => b.state.band !== 'paused')
    // Each admitted call then spends; show the overshoot.
    await Promise.all(
      admitted.map(async (ai) => {
        const c = collectUsage(async () => recordUsage(usageRecord('anthropic', 'claude-opus-5-5', { inputTokens: 7000, outputTokens: 16000, cachedInputTokens: 0, cacheWriteTokens: 5000 })), ai.scope)
        await c.run
        await ai.settle(c.usage().costUsd)
      })
    )
    // With N = 20 the user ends near 0.49 + 20 x 0.37 = $7.95 on a $0.50 cap.
    expect(admitted.length).toBeLessThanOrEqual(1)
    expect(db.spent).toBeLessThan(0.5 + OPUS_WORST_ATTEMPT)
  })

  // Correct: the daily ceiling counts the success event written AFTER the model call, so at
  // 19 of 20 every parallel request passes.
  it.fails('daily ceiling at 19/20: parallel requests do not all pass', async () => {
    db.todayCount = 19
    const checks = await Promise.all(Array.from({ length: 10 }, () => checkDailyCeiling('u', 'tailor', now)))
    expect(checks.filter((c) => c.allowed).length).toBeLessThanOrEqual(1)
  })
})

describe('admin override route', () => {
  const call = (body: any) =>
    adminCapPOST(new Request('http://x/api/admin/users/u1/ai-cap', { method: 'POST', body: JSON.stringify(body) }) as any, {
      params: Promise.resolve({ id: 'u1' }),
    })

  it('401 without a session, 403 for a non-admin', async () => {
    expect((await call({ capUsd: 50 })).status).toBe(401)
    db.session = { user: { email: 'someone@example.com' } }
    expect((await call({ capUsd: 50 })).status).toBe(403)
    expect(db.overrides.has('u1')).toBe(false)
  })

  it('admin can set, range-check and clear an override, and it changes the cap', async () => {
    db.session = { user: { email: 'hellojakejohn@gmail.com' } }
    expect((await call({ capUsd: 5000 })).status).toBe(400)
    expect((await call({ capUsd: -1 })).status).toBe(400)
    const ok = await call({ capUsd: 2 })
    expect(ok.status).toBe(200)
    expect((await getCapState('u1', now)).capUsd).toBe(2)
    await call({ capUsd: null })
    expect((await getCapState('u1', now)).capUsd).toBe(0.5)
  })
})
