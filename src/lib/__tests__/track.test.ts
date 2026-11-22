// track(): writes one events row, never throws. Usage collection and cost estimate.
/* eslint-disable @typescript-eslint/no-unused-vars -- mock signatures keep their params for typed mock.calls */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ create: vi.fn(async (..._: unknown[]) => ({})) }))
vi.mock('@/lib/prisma', () => ({ prisma: { event: { create: db.create } } }))

import { msSince, track } from '@/lib/track'
import { collectUsage, currentRouting, recordUsage, usageProps, usageRecord } from '@/lib/ai-usage'
import { costUsd } from '@/lib/ai/models'

beforeEach(() => db.create.mockReset().mockResolvedValue({}))

describe('track', () => {
  it('writes the event with userId and props', async () => {
    await track('tailored', { ms: 1200, coverageBefore: 40, coverageAfter: 72, warnings: 1 }, 'user_1')
    expect(db.create).toHaveBeenCalledWith({
      data: { name: 'tailored', userId: 'user_1', props: { ms: 1200, coverageBefore: 40, coverageAfter: 72, warnings: 1 } },
    })
  })

  it('stores anonymous events with a null userId', async () => {
    await track('account_deleted')
    expect(db.create).toHaveBeenCalledWith({ data: { name: 'account_deleted', userId: null, props: {} } })
  })

  it('drops undefined props and non-finite numbers', async () => {
    await track('limit_hit', { kind: 'tailor', extra: undefined, limit: Infinity }, 'u')
    expect(db.create).toHaveBeenCalledWith({ data: { name: 'limit_hit', userId: 'u', props: { kind: 'tailor', limit: null } } })
  })

  it('never throws when the insert fails', async () => {
    db.create.mockRejectedValueOnce(new Error('relation "events" does not exist'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(track('signed_up', {}, 'u')).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('msSince rounds elapsed time', () => {
    expect(msSince(Date.now() - 50)).toBeGreaterThanOrEqual(50)
  })
})

describe('AI usage', () => {
  const completion = (model: string, input: number, output: number, cached = 0) =>
    usageRecord('anthropic', model, { inputTokens: input, outputTokens: output, cachedInputTokens: cached })

  it('collects every call made inside collectUsage, including nested awaits', async () => {
    const { run, usage } = collectUsage(async () => {
      recordUsage(completion('claude-opus-5-5-20261001', 1000, 500))
      await new Promise((r) => setTimeout(r, 1))
      recordUsage(completion('claude-sonnet-5-5', 2000, 100))
      return 'ok'
    })
    expect(await run).toBe('ok')
    const summary = usage()
    expect(summary).toMatchObject({ calls: 2, tokensIn: 3000, tokensOut: 600, model: 'claude-sonnet-5-5' })
    // Opus: 1000 * 4 + 500 * 20 = 14000; Sonnet: 2000 * 2 + 100 * 10 = 5000 -> per 1M
    expect(summary.costUsd).toBeCloseTo(0.019, 6)
  })

  it('keeps usage when the work throws', async () => {
    const { run, usage } = collectUsage(async () => {
      recordUsage(completion('claude-opus-5-5', 10, 0))
      throw new Error('bad output')
    })
    await expect(run).rejects.toThrow('bad output')
    expect(usage().calls).toBe(1)
  })

  it('ignores calls outside collectUsage and keeps concurrent requests apart', async () => {
    recordUsage(completion('claude-opus-5-5', 999, 999))
    const a = collectUsage(async () => recordUsage(completion('claude-opus-5-5', 1, 1)))
    const b = collectUsage(async () => {
      recordUsage(completion('claude-opus-5-5', 2, 2))
      recordUsage(completion('claude-opus-5-5', 2, 2))
    })
    await Promise.all([a.run, b.run])
    expect(a.usage().calls).toBe(1)
    expect(b.usage().calls).toBe(2)
  })

  it('hands every call to the scope sink and carries the routing context', async () => {
    const seen: string[] = []
    const { run } = collectUsage(
      async () => {
        expect(currentRouting()).toEqual({ tier: 'pro', downgraded: true })
        recordUsage(completion('claude-opus-5-5', 10, 10))
      },
      { routing: { tier: 'pro', downgraded: true }, onCall: (r) => seen.push(r.model) }
    )
    await run
    expect(seen).toEqual(['claude-opus-5-5'])
    expect(currentRouting()).toBeUndefined()
  })

  it('prices from models.ts: dated snapshots by family, cache reads, unknown models like Opus', () => {
    expect(costUsd('claude-sonnet-5-5-20261001', { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 0 })).toBe(2)
    expect(costUsd('claude-opus-5-5', { inputTokens: 1_000_000, outputTokens: 1_000_000, cachedInputTokens: 1_000_000 })).toBe(24.2)
    expect(costUsd('claude-sonnet-5-5', { inputTokens: 1_000_000, outputTokens: 1_000_000, cachedInputTokens: 0 })).toBe(12)
    expect(costUsd('some-new-model', { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 0 })).toBe(4)
  })

  it('usageProps is empty when no model ran, and never carries costUsd (ai_call events do)', () => {
    expect(usageProps({ calls: 0, tokensIn: 0, tokensOut: 0, cachedIn: 0, costUsd: 0 })).toEqual({})
    expect(usageProps({ calls: 1, tokensIn: 5, tokensOut: 5, cachedIn: 0, costUsd: 1, model: 'x' })).not.toHaveProperty('costUsd')
  })
})
