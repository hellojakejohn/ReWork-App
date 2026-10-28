// /api/health lists each routed Anthropic model's accepted refusal fallbacks (GET /v1/models),
// whether the ping passes or fails, and never throws if the lookup fails.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ create: vi.fn(), retrieve: vi.fn() }))

vi.mock('@/lib/ai/adapters/anthropic', async (orig) => ({
  ...(await orig<any>()),
  anthropicClient: () => ({ beta: { messages: { create: api.create }, models: { retrieve: api.retrieve } } }),
}))

import { checkProviders } from '@/lib/ai/health'

const KEYS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY']
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k]
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
  delete process.env.OPENAI_API_KEY
  delete process.env.OPENROUTER_API_KEY
  api.create.mockReset()
  api.retrieve.mockReset()
  api.retrieve.mockImplementation(async (id: string) => ({ id, allowed_fallback_models: id === 'claude-opus-5-5' ? ['claude-opus-4-8'] : [] }))
})
afterEach(() => {
  for (const k of KEYS) (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]))
})

describe('health: accepted Anthropic fallbacks', () => {
  it('lists them for every routed Anthropic model when the ping passes', async () => {
    api.create.mockResolvedValue({ model: 'claude-opus-5-5' })
    const { anthropic } = await checkProviders()
    expect(anthropic.ok).toBe(true)
    expect(anthropic.allowedFallbacks).toEqual({ 'claude-opus-5-5': ['claude-opus-4-8'], 'claude-sonnet-5-5': [] })
  })

  it('still lists them when the ping fails', async () => {
    api.create.mockRejectedValue(Object.assign(new Error('400 bad fallback'), { status: 400 }))
    const { anthropic } = await checkProviders()
    expect(anthropic.ok).toBe(false)
    expect(anthropic.allowedFallbacks?.['claude-opus-5-5']).toEqual(['claude-opus-4-8'])
  })

  it('a lookup that fails is reported, not thrown', async () => {
    api.create.mockResolvedValue({ model: 'claude-opus-5-5' })
    api.retrieve.mockRejectedValue(new Error('404 not found'))
    const { anthropic } = await checkProviders()
    expect(anthropic.ok).toBe(true)
    expect(anthropic.allowedFallbacks?.['claude-opus-5-5']).toMatch(/^unreadable: 404/)
  })
})
