// Launch audit: the per-user in-flight limit (src/lib/ai-inflight.ts) and the global AI
// switches in getAIBudget (kill switch, global daily ceiling). In-memory events table.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  rows: [] as { id: string; userId: string; name: string; createdAt: Date }[],
  n: 0,
  globalSpent: 0,
  burnSpent: 0,
  isPro: false,
  entitlements: [] as any[],
  lastGlobalSql: '',
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    event: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `e${++db.n}`, userId: data.userId, name: data.name, createdAt: data.createdAt ?? new Date() }
        db.rows.push(row)
        return { id: row.id }
      }),
      count: vi.fn(async ({ where }: any) =>
        db.rows.filter((r) => r.userId === where.userId && r.name === where.name && r.createdAt >= where.createdAt.gte).length
      ),
      deleteMany: vi.fn(async ({ where }: any) => {
        db.rows = db.rows.filter((r) => r.id !== where.id)
        return { count: 1 }
      }),
    },
    entitlement: { findMany: vi.fn(async () => db.entitlements) },
    aiCapOverride: { findUnique: vi.fn(async () => null) },
    // Per-user spend and global spend both come through here; the SQL text tells them apart.
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('')
      if (sql.includes('"userId" =')) return [{ spent: 0 }]
      db.lastGlobalSql = sql
      return [{ spent: values.at(-1) === 'burn' ? db.burnSpent : db.globalSpent }]
    }),
  },
}))
vi.mock('@/lib/entitlements', () => ({ getAccess: vi.fn(async () => ({ isPro: db.isPro })) }))

import { AI_MAX_INFLIGHT, AIInflightError, acquireInflightSlot } from '@/lib/ai-inflight'
import {
  AI_BURN_CEILING_MESSAGE,
  AI_DISABLED_MESSAGE,
  AI_FREE_CEILING_MESSAGE,
  DEFAULT_BURN_DAILY_USD,
  DEFAULT_FREE_DAILY_USD,
  getAIBudget,
  resetGlobalSpendCache,
} from '@/lib/ai-cap'
import { classifyAIError } from '@/lib/ai-errors'
import { collectUsage, takeCallSlot } from '@/lib/ai-usage'

const ENV_KEYS = ['AI_DISABLED', 'AI_FREE_DAILY_USD', 'AI_BURN_DAILY_USD'] as const
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
beforeEach(() => {
  db.rows = []
  db.globalSpent = 0
  db.burnSpent = 0
  db.isPro = false
  db.entitlements = []
  resetGlobalSpendCache()
  for (const k of ENV_KEYS) delete process.env[k]
})
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

const burnRow = () => ({
  source: 'TOKEN_PAYMENT',
  status: 'ACTIVE',
  startsAt: new Date(Date.now() - 86_400_000),
  endsAt: new Date(Date.now() + 29 * 86_400_000),
  cancelAtPeriodEnd: false,
  pastDueAt: null,
})

describe('in-flight slots', () => {
  it(`admits ${AI_MAX_INFLIGHT} calls at once, refuses the next, and frees a slot on release`, async () => {
    const a = await acquireInflightSlot('u')
    await acquireInflightSlot('u')
    await expect(acquireInflightSlot('u')).rejects.toBeInstanceOf(AIInflightError)
    expect(db.rows).toHaveLength(AI_MAX_INFLIGHT) // the refused call removed its own row
    await a()
    await expect(acquireInflightSlot('u')).resolves.toBeTypeOf('function')
  })

  it('a burst of 20 parallel calls never admits more than the limit', async () => {
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => acquireInflightSlot('u')))
    expect(results.filter((r) => r.status === 'fulfilled').length).toBeLessThanOrEqual(AI_MAX_INFLIGHT)
  })

  it('other users are not affected', async () => {
    await acquireInflightSlot('u')
    await acquireInflightSlot('u')
    await expect(acquireInflightSlot('someone-else')).resolves.toBeTypeOf('function')
  })

  it('a row left by a killed function stops counting after the TTL', async () => {
    db.rows.push(
      { id: 'old1', userId: 'u', name: 'ai_inflight', createdAt: new Date(Date.now() - 7 * 60_000) },
      { id: 'old2', userId: 'u', name: 'ai_inflight', createdAt: new Date(Date.now() - 7 * 60_000) }
    )
    await expect(acquireInflightSlot('u')).resolves.toBeTypeOf('function')
  })

  it('the budget scope takes a slot per call and the refusal reads as a human message', async () => {
    const ai = await getAIBudget('u')
    const held: Array<() => Promise<void>> = []
    const { run } = collectUsage(async () => {
      held.push(await takeCallSlot(), await takeCallSlot())
      await takeCallSlot()
    }, ai.scope)
    const error = await run.catch((e) => e)
    expect(error).toBeInstanceOf(AIInflightError)
    const classified = classifyAIError(error, 'Tailoring')
    expect(classified).toMatchObject({ kind: 'rate_limit', status: 429 })
    expect(classified.userMessage).toMatch(/already have AI work running/)
  })
})

describe('global switches', () => {
  it('AI_DISABLED pauses everyone with the maintenance message', async () => {
    process.env.AI_DISABLED = '1'
    const ai = await getAIBudget('u')
    expect(ai.state.band).toBe('paused')
    expect(ai.pausedMessage).toBe(AI_DISABLED_MESSAGE)
  })

  it(`the free daily ceiling (default $${DEFAULT_FREE_DAILY_USD}) pauses free accounts once free-tier spend reaches it`, async () => {
    db.globalSpent = DEFAULT_FREE_DAILY_USD - 1
    expect((await getAIBudget('u')).state.band).not.toBe('paused')
    resetGlobalSpendCache()
    db.globalSpent = DEFAULT_FREE_DAILY_USD
    const ai = await getAIBudget('u')
    expect(ai.state.band).toBe('paused')
    expect(ai.pausedMessage).toBe(AI_FREE_CEILING_MESSAGE)
    expect(db.lastGlobalSql).toContain("'tier'")
  })

  it('paying users are never paused by free-tier spend (their own cap covers them)', async () => {
    db.isPro = true
    db.globalSpent = 10_000
    expect((await getAIBudget('u')).state.band).not.toBe('paused')
  })

  it('AI_DISABLED still pauses paying users', async () => {
    db.isPro = true
    process.env.AI_DISABLED = 'true'
    expect((await getAIBudget('u')).pausedMessage).toBe(AI_DISABLED_MESSAGE)
  })

  it('AI_FREE_DAILY_USD sets the ceiling and 0 turns it off', async () => {
    db.globalSpent = 1000
    process.env.AI_FREE_DAILY_USD = '0'
    expect((await getAIBudget('u')).state.band).not.toBe('paused')
    process.env.AI_FREE_DAILY_USD = '20'
    resetGlobalSpendCache()
    db.globalSpent = 25
    expect((await getAIBudget('u')).state.band).toBe('paused')
  })
})

describe('burn-Pro daily ceiling', () => {
  it(`pauses burn-Pro accounts once their shared spend reaches $${DEFAULT_BURN_DAILY_USD}, and logs calls as burn`, async () => {
    db.isPro = true
    db.entitlements = [burnRow()]
    db.burnSpent = DEFAULT_BURN_DAILY_USD - 0.01
    const ok = await getAIBudget('u')
    expect(ok.state.period.kind).toBe('burn')
    expect(ok.state.capUsd).toBe(10.5) // 0.70 x $15, no Stripe cut
    expect(ok.state.band).not.toBe('paused')
    resetGlobalSpendCache()
    db.burnSpent = DEFAULT_BURN_DAILY_USD
    const paused = await getAIBudget('u')
    expect(paused.state.band).toBe('paused')
    expect(paused.pausedMessage).toBe(AI_BURN_CEILING_MESSAGE)
  })

  it('card-paid Pro is never paused by burn spend, even with a burn row too', async () => {
    db.isPro = true
    db.burnSpent = 1000
    expect((await getAIBudget('u')).state.band).not.toBe('paused') // comp/card, no burn row
  })

  it('free-tier spend does not count against burn-Pro and vice versa', async () => {
    db.isPro = true
    db.entitlements = [burnRow()]
    db.globalSpent = 1000
    expect((await getAIBudget('u')).state.band).not.toBe('paused')
  })

  it('AI_BURN_DAILY_USD sets the ceiling and 0 turns it off', async () => {
    db.isPro = true
    db.entitlements = [burnRow()]
    db.burnSpent = 5
    process.env.AI_BURN_DAILY_USD = '4'
    expect((await getAIBudget('u')).pausedMessage).toBe(AI_BURN_CEILING_MESSAGE)
    process.env.AI_BURN_DAILY_USD = '0'
    expect((await getAIBudget('u')).state.band).not.toBe('paused')
  })
})
