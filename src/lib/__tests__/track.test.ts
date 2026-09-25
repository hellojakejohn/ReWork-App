// track(): writes one events row, never throws. Usage collection and cost estimate.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ create: vi.fn(async (_args: unknown) => ({})) }))
vi.mock('@/lib/prisma', () => ({ prisma: { event: { create: db.create } } }))

import { msSince, track } from '@/lib/track'
import { collectUsage, estimateCostUsd, priceFor, recordUsage, usageProps } from '@/lib/ai-usage'

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
  const completion = (model: string, input: number, output: number) => ({ model, usage: { prompt_tokens: input, completion_tokens: output } })

  it('collects every call made inside collectUsage, including nested awaits', async () => {
    const { run, usage } = collectUsage(async () => {
      recordUsage(completion('gpt-4o-2024-08-06', 1000, 500))
      await new Promise((r) => setTimeout(r, 1))
      recordUsage(completion('gpt-4o-mini', 2000, 100))
      return 'ok'
    })
    expect(await run).toBe('ok')
    const summary = usage()
    expect(summary).toMatchObject({ calls: 2, tokensIn: 3000, tokensOut: 600, model: 'gpt-4o-mini' })
    // gpt-4o: 1000 * 2.5 + 500 * 10 = 7500; mini: 2000 * 0.15 + 100 * 0.6 = 360 -> per 1M
    expect(summary.costUsd).toBeCloseTo(0.00786, 6)
  })

  it('keeps usage when the work throws', async () => {
    const { run, usage } = collectUsage(async () => {
      recordUsage(completion('gpt-4o', 10, 0))
      throw new Error('bad output')
    })
    await expect(run).rejects.toThrow('bad output')
    expect(usage().calls).toBe(1)
  })

  it('ignores calls outside collectUsage and keeps concurrent requests apart', async () => {
    recordUsage(completion('gpt-4o', 999, 999))
    const a = collectUsage(async () => recordUsage(completion('gpt-4o', 1, 1)))
    const b = collectUsage(async () => {
      recordUsage(completion('gpt-4o', 2, 2))
      recordUsage(completion('gpt-4o', 2, 2))
    })
    await Promise.all([a.run, b.run])
    expect(a.usage().calls).toBe(1)
    expect(b.usage().calls).toBe(2)
  })

  it('prices dated snapshots by family and unknown models like gpt-4o', () => {
    expect(priceFor('gpt-4o-mini-2024-07-18')).toEqual([0.15, 0.6])
    expect(priceFor('gpt-4o-2024-11-20')).toEqual([2.5, 10])
    expect(priceFor('some-new-model')).toEqual([2.5, 10])
    expect(estimateCostUsd([{ model: 'gpt-4o', tokensIn: 1_000_000, tokensOut: 0 }])).toBe(2.5)
  })

  it('usageProps is empty when no model ran', () => {
    expect(usageProps({ calls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 })).toEqual({})
  })
})
