// /api/health pings every routed Anthropic model (Opus, and Sonnet for the free tier and the
// decline retry) and lists each one's accepted refusal fallbacks (GET /v1/models). Never throws.
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
    expect(anthropic.others).toEqual({ 'claude-sonnet-5-5': { ok: true, ms: expect.any(Number) } })
    expect(anthropic.allowedFallbacks).toEqual({ 'claude-opus-5-5': ['claude-opus-4-8'], 'claude-sonnet-5-5': [] })
  })

  it('still lists them when the ping fails', async () => {
    api.create.mockRejectedValue(Object.assign(new Error('400 bad fallback'), { status: 400 }))
    const { anthropic } = await checkProviders()
    expect(anthropic.ok).toBe(false)
    expect(anthropic.allowedFallbacks?.['claude-opus-5-5']).toEqual(['claude-opus-4-8'])
  })

  it('pings Sonnet too (free tier and the decline retry), and fails if Sonnet fails', async () => {
    api.create.mockImplementation(async (body: any) => {
      if (body.model === 'claude-sonnet-5-5') throw Object.assign(new Error('529 overloaded'), { status: 529 })
      return { model: body.model }
    })
    const { anthropic } = await checkProviders()
    expect(api.create.mock.calls.map((c: any) => c[0].model).sort()).toEqual(['claude-opus-5-5', 'claude-sonnet-5-5'])
    expect(anthropic.model).toBe('claude-opus-5-5')
    expect(anthropic.others?.['claude-sonnet-5-5']).toMatchObject({ ok: false })
    expect(anthropic.ok).toBe(false)
  })

  it('a lookup that fails is reported, not thrown', async () => {
    api.create.mockResolvedValue({ model: 'claude-opus-5-5' })
    api.retrieve.mockRejectedValue(new Error('404 not found'))
    const { anthropic } = await checkProviders()
    expect(anthropic.ok).toBe(true)
    expect(anthropic.allowedFallbacks?.['claude-opus-5-5']).toMatch(/^unreadable: 404/)
  })
})
