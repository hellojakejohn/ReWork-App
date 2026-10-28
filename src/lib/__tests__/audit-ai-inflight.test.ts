// Launch audit: the per-user in-flight limit (src/lib/ai-inflight.ts) and the global AI
// switches in getAIBudget (kill switch, global daily ceiling). In-memory events table.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  rows: [] as { id: string; userId: string; name: string; createdAt: Date }[],
  n: 0,
  globalSpent: 0,
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
    entitlement: { findMany: vi.fn(async () => []) },
    aiCapOverride: { findUnique: vi.fn(async () => null) },
    // Per-user spend and global spend both come through here; the SQL text tells them apart.
    $queryRaw: vi.fn(async (strings: TemplateStringsArray) =>
      strings.join('').includes('"userId" =') ? [{ spent: 0 }] : [{ spent: db.globalSpent }]
    ),
  },
}))
vi.mock('@/lib/entitlements', () => ({ getAccess: vi.fn(async () => ({ isPro: false })) }))

import { AI_MAX_INFLIGHT, AIInflightError, acquireInflightSlot } from '@/lib/ai-inflight'
import { AI_DISABLED_MESSAGE, AI_GLOBAL_CEILING_MESSAGE, DEFAULT_GLOBAL_DAILY_USD, getAIBudget, resetGlobalSpendCache } from '@/lib/ai-cap'
import { classifyAIError } from '@/lib/ai-errors'
import { collectUsage, takeCallSlot } from '@/lib/ai-usage'

const saved = { disabled: process.env.AI_DISABLED, ceiling: process.env.AI_GLOBAL_DAILY_USD }
beforeEach(() => {
  db.rows = []
  db.globalSpent = 0
  resetGlobalSpendCache()
  delete process.env.AI_DISABLED
  delete process.env.AI_GLOBAL_DAILY_USD
})
afterEach(() => {
  if (saved.disabled === undefined) delete process.env.AI_DISABLED
  else process.env.AI_DISABLED = saved.disabled
  if (saved.ceiling === undefined) delete process.env.AI_GLOBAL_DAILY_USD
  else process.env.AI_GLOBAL_DAILY_USD = saved.ceiling
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

  it(`the global daily ceiling (default $${DEFAULT_GLOBAL_DAILY_USD}) pauses everyone once reached`, async () => {
    db.globalSpent = DEFAULT_GLOBAL_DAILY_USD - 1
    expect((await getAIBudget('u')).state.band).not.toBe('paused')
    resetGlobalSpendCache()
    db.globalSpent = DEFAULT_GLOBAL_DAILY_USD
    const ai = await getAIBudget('u')
    expect(ai.state.band).toBe('paused')
    expect(ai.pausedMessage).toBe(AI_GLOBAL_CEILING_MESSAGE)
  })

  it('AI_GLOBAL_DAILY_USD sets the ceiling and 0 turns it off', async () => {
    db.globalSpent = 1000
    process.env.AI_GLOBAL_DAILY_USD = '0'
    expect((await getAIBudget('u')).state.band).not.toBe('paused')
    process.env.AI_GLOBAL_DAILY_USD = '20'
    resetGlobalSpendCache()
    db.globalSpent = 25
    expect((await getAIBudget('u')).state.band).toBe('paused')
  })
})
