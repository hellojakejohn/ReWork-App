// Provider layer with mocked SDK clients: structured output, repair, PDF shape, routing,
// temperature handling, and error classification across providers.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import { APIError as OpenAIAPIError } from 'openai'
import { generateStructured, parseAndValidate, callOverrides } from '@/lib/ai'
import { buildAnthropicRequest, FALLBACK_BETA, refusalFallbackFor } from '@/lib/ai/adapters/anthropic'
import { buildOpenAIRequest } from '@/lib/ai/adapters/openai'
import { buildOpenRouterRequest } from '@/lib/ai/adapters/openrouter'
import { downgradeAvailable, parseRoute, resolveRoute, showPoweredBy, taskRoute } from '@/lib/ai/routing'
import { AIOutputError, classifyAIError } from '@/lib/ai-errors'
import { collectUsage } from '@/lib/ai-usage'
import { MODELS, modelInfo } from '@/lib/ai/models'

const SCHEMA = {
  type: 'object',
  properties: { title: { type: 'string' }, bullets: { type: 'array', items: { type: 'string' } } },
  required: ['title', 'bullets'],
  additionalProperties: false,
}
const GOOD = { title: 'Engineer', bullets: ['Shipped billing'] }

const base = {
  task: 'tailor' as const,
  system: 'You tailor resumes.',
  messages: [{ role: 'user' as const, content: 'Tailor this.' }],
  schema: SCHEMA,
  schemaName: 'out',
  maxTokens: 1000,
  temperature: 0.3,
}

function anthropicMock(...replies: any[]) {
  const create = vi.fn(async () => {
    const next = replies.shift()
    if (next instanceof Error) throw next
    return next
  })
  return { client: { beta: { messages: { create } } }, create }
}

const anthropicReply = (text: string, extra: Record<string, any> = {}) => ({
  model: 'claude-opus-5-5',
  stop_reason: 'end_turn',
  content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }],
  usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 500, cache_creation_input_tokens: 0 },
  ...extra,
})

function chatMock(...replies: any[]) {
  const create = vi.fn(async () => {
    const next = replies.shift()
    if (next instanceof Error) throw next
    return next
  })
  return { client: { chat: { completions: { create } } }, create }
}

const chatReply = (content: string, model = 'gpt-4o-2024-08-06') => ({
  model,
  choices: [{ finish_reason: 'stop', message: { content, refusal: null } }],
  usage: { prompt_tokens: 1200, completion_tokens: 300, prompt_tokens_details: { cached_tokens: 200 } },
})

const ENV_KEYS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'AI_PARSE', 'AI_JOB_EXTRACT', 'AI_TAILOR', 'AI_COVER_LETTER', 'AI_EVIDENCE', 'AI_FREE_TIER', 'OPENAI_TAILOR_MODEL', 'OPENAI_JOB_MODEL']
let saved: Record<string, string | undefined> = {}
beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  for (const k of ENV_KEYS) delete process.env[k]
})
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
  vi.restoreAllMocks()
})

describe('anthropic adapter', () => {
  it('returns schema-valid data with usage, cost, model and timing (happy path)', async () => {
    const { client, create } = anthropicMock(anthropicReply(JSON.stringify(GOOD)))
    const res = await generateStructured<typeof GOOD>({ ...base, route: { provider: 'anthropic', model: 'claude-opus-5-5' }, clients: { anthropic: client } })
    expect(res.data).toEqual(GOOD)
    expect(res).toMatchObject({ provider: 'anthropic', model: 'claude-opus-5-5', attempts: 1 })
    expect(res.usage).toEqual({ inputTokens: 1000, outputTokens: 200, cachedInputTokens: 500, cacheWriteTokens: 0 })
    // 1000 * 4 + 200 * 20 + 500 * 0.2 = 8100 per 1M
    expect(res.costUsd).toBeCloseTo(0.0081, 6)
    expect(res.ms).toBeGreaterThanOrEqual(0)

    const body = (create.mock.calls[0] as any[])[0]
    expect(body.output_config.format).toEqual({ type: 'json_schema', schema: SCHEMA })
    expect(body).not.toHaveProperty('output_format') // deprecated param, 400s without its beta
    expect(body).not.toHaveProperty('temperature') // Opus 5.5 rejects temperature
    expect(body.system).toEqual([{ type: 'text', text: 'You tailor resumes.', cache_control: { type: 'ephemeral' } }])
    expect(body.betas).toEqual([FALLBACK_BETA])
    expect(body.fallbacks).toEqual([{ model: 'claude-sonnet-5-5' }])
    expect(body.max_tokens).toBeGreaterThan(1000) // thinking headroom
    expect(body.max_tokens).toBeLessThanOrEqual(16000)
  })

  it('sends a PDF as a base64 document block before the text', () => {
    const pdf = Buffer.from('%PDF-1.7 fake')
    const body = buildAnthropicRequest({
      model: 'claude-sonnet-5-5',
      system: 's',
      messages: [{ role: 'user', content: 'Parse this.' }],
      files: [{ kind: 'pdf', data: pdf, filename: 'resume.pdf' }],
      schema: SCHEMA,
      schemaName: 'x',
      maxTokens: 8000,
      effort: 'low',
    })
    expect(body.messages[0].content).toEqual([
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf.toString('base64') }, title: 'resume.pdf' },
      { type: 'text', text: 'Parse this.' },
    ])
    expect(body.messages[0].content[0].source.data).not.toMatch(/\s/)
    expect(body.output_config.effort).toBe('low')
  })

  it('repairs invalid JSON once, then succeeds', async () => {
    const { client, create } = anthropicMock(anthropicReply('{"title": "Engineer", "bullets": ['), anthropicReply(JSON.stringify(GOOD)))
    const { run, usage } = collectUsage(() =>
      generateStructured<typeof GOOD>({ ...base, route: { provider: 'anthropic', model: 'claude-opus-5-5' }, clients: { anthropic: client } })
    )
    const res = await run
    expect(res.data).toEqual(GOOD)
    expect(res.attempts).toBe(2)
    expect(create).toHaveBeenCalledTimes(2)
    const retry = (create.mock.calls[1] as any[])[0]
    expect(retry.messages.map((m: any) => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(retry.messages[2].content).toMatch(/Not valid JSON/)
    expect(usage().calls).toBe(2) // both attempts are billed and recorded
  })

  it('throws invalid_output after a failed repair', async () => {
    const { client } = anthropicMock(anthropicReply('{"title": 1}'), anthropicReply('{"title": 2}'))
    const error = await generateStructured({ ...base, route: { provider: 'anthropic', model: 'claude-opus-5-5' }, clients: { anthropic: client } }).catch((e) => e)
    expect(error).toBeInstanceOf(AIOutputError)
    expect(error.reason).toBe('invalid')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(classifyAIError(error).kind).toBe('invalid_output')
  })

  it('refusal fallback stays on Anthropic: Opus 5.5 -> Sonnet 5.5, never OpenAI or OpenRouter', async () => {
    expect(FALLBACK_BETA).toBe('server-side-fallback-2026-06-01') // the array form's beta
    expect(refusalFallbackFor('claude-opus-5-5')).toBe('claude-sonnet-5-5')
    // Sonnet 5.5 only accepts the category-routed "default" form, so it gets no fallback.
    expect(refusalFallbackFor('claude-sonnet-5-5')).toBeNull()
    const sonnet = buildAnthropicRequest({ model: 'claude-sonnet-5-5', system: 's', messages: [{ role: 'user', content: 'x' }], files: [], schema: SCHEMA, schemaName: 'x', maxTokens: 10 })
    expect(sonnet).not.toHaveProperty('fallbacks')
    expect(sonnet).not.toHaveProperty('betas')

    // Every configured fallback, anywhere in the table, is an Anthropic model.
    for (const m of Object.values(MODELS)) {
      if (!m.refusalFallback) continue
      expect(m.provider).toBe('anthropic')
      expect(modelInfo(m.refusalFallback).provider).toBe('anthropic')
    }
    // Even a misconfigured entry pointing elsewhere is dropped, not sent.
    const original = MODELS['claude-opus-5-5'].refusalFallback
    try {
      for (const bad of ['gpt-4o', 'moonshotai/kimi-k2.6']) {
        MODELS['claude-opus-5-5'].refusalFallback = bad
        expect(refusalFallbackFor('claude-opus-5-5')).toBeNull()
        const body = buildAnthropicRequest({ model: 'claude-opus-5-5', system: 's', messages: [{ role: 'user', content: 'x' }], files: [], schema: SCHEMA, schemaName: 'x', maxTokens: 10 })
        expect(body).not.toHaveProperty('fallbacks')
      }
    } finally {
      MODELS['claude-opus-5-5'].refusalFallback = original
    }

    // A refusal that survives the server-side fallback is an error, not a hop to another provider.
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.OPENROUTER_API_KEY = 'or-test'
    const refused = anthropicMock(anthropicReply('', { stop_reason: 'refusal', model: 'claude-sonnet-5-5' }))
    const openai = chatMock(chatReply(JSON.stringify(GOOD)))
    const openrouter = chatMock(chatReply(JSON.stringify(GOOD), 'moonshotai/kimi-k2.6'))
    const error = await generateStructured({
      ...base,
      route: { provider: 'anthropic', model: 'claude-opus-5-5' },
      clients: { anthropic: refused.client, openai: openai.client, openrouter: openrouter.client },
    }).catch((e) => e)
    expect(error).toBeInstanceOf(AIOutputError)
    expect(error).toMatchObject({ reason: 'refusal', provider: 'anthropic' })
    expect(refused.create).toHaveBeenCalledTimes(1)
    expect(openai.create).not.toHaveBeenCalled()
    expect(openrouter.create).not.toHaveBeenCalled()
  })

  it('prices a fallback answer at the model that served it', async () => {
    const { client } = anthropicMock(anthropicReply(JSON.stringify(GOOD), { model: 'claude-sonnet-5-5' }))
    const res = await generateStructured({ ...base, route: { provider: 'anthropic', model: 'claude-opus-5-5' }, clients: { anthropic: client } })
    expect(res.model).toBe('claude-sonnet-5-5')
    // Sonnet prices: 1000 * 2 + 200 * 10 + 500 * 0.2 = 4100 per 1M
    expect(res.costUsd).toBeCloseTo(0.0041, 6)
  })

  it('maps refusal and max_tokens stop reasons', async () => {
    const refused = anthropicMock(anthropicReply('', { stop_reason: 'refusal' }))
    const e1 = await generateStructured({ ...base, route: { provider: 'anthropic', model: 'claude-opus-5-5' }, clients: { anthropic: refused.client } }).catch((e) => e)
    expect(e1).toMatchObject({ reason: 'refusal' })
    const cut = anthropicMock(anthropicReply('{"title"', { stop_reason: 'max_tokens' }))
    const e2 = await generateStructured({ ...base, route: { provider: 'anthropic', model: 'claude-opus-5-5' }, clients: { anthropic: cut.client } }).catch((e) => e)
    expect(e2).toMatchObject({ reason: 'truncated' })
  })
})

describe('openai adapter', () => {
  it('keeps the old behavior: json_schema strict, temperature, file part for PDFs', async () => {
    const { client, create } = chatMock(chatReply(JSON.stringify(GOOD)))
    const res = await generateStructured<typeof GOOD>({
      ...base,
      files: [{ kind: 'pdf', data: Buffer.from('pdf'), filename: 'r.pdf' }],
      route: { provider: 'openai', model: 'gpt-4o' },
      clients: { openai: client },
    })
    expect(res.data).toEqual(GOOD)
    // prompt_tokens includes the cached ones
    expect(res.usage).toMatchObject({ inputTokens: 1000, cachedInputTokens: 200, outputTokens: 300 })
    const body = (create.mock.calls[0] as any[])[0]
    expect(body.temperature).toBe(0.3)
    expect(body.max_tokens).toBe(1000)
    expect(body.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'out', strict: true, schema: SCHEMA } })
    expect(body.messages[0]).toEqual({ role: 'system', content: 'You tailor resumes.' })
    expect(body.messages[1].content[0]).toEqual({ type: 'file', file: { filename: 'r.pdf', file_data: `data:application/pdf;base64,${Buffer.from('pdf').toString('base64')}` } })
  })

  it('drops temperature and uses max_completion_tokens on reasoning models', () => {
    const body = buildOpenAIRequest({ model: 'gpt-5.4-mini', system: 's', messages: [{ role: 'user', content: 'x' }], files: [], schema: SCHEMA, schemaName: 'x', maxTokens: 500, temperature: 0.5 })
    expect(body).not.toHaveProperty('temperature')
    expect(body).not.toHaveProperty('max_tokens')
    expect(body.max_completion_tokens).toBeGreaterThanOrEqual(500)
  })
})

describe('openrouter adapter', () => {
  it('uses JSON mode with the schema in the prompt, denies data collection, and never sends files', async () => {
    const { client, create } = chatMock(chatReply('```json\n' + JSON.stringify(GOOD) + '\n```', 'moonshotai/kimi-k2.6'))
    const res = await generateStructured<typeof GOOD>({
      ...base,
      files: [{ kind: 'pdf', data: Buffer.from('pdf'), filename: 'r.pdf' }],
      route: { provider: 'openrouter', model: 'moonshotai/kimi-k2.6' },
      clients: { openrouter: client },
    })
    expect(res.data).toEqual(GOOD) // code fence stripped
    const body = (create.mock.calls[0] as any[])[0]
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.provider).toEqual({ data_collection: 'deny' })
    expect(body.messages[0].content).toContain('"additionalProperties":false')
    expect(JSON.stringify(body.messages)).not.toContain('application/pdf')
  })

  it('repairs a schema-invalid answer with the validation errors spelled out', async () => {
    const { client, create } = chatMock(chatReply(JSON.stringify({ title: 'x' }), 'moonshotai/kimi-k2.6'), chatReply(JSON.stringify(GOOD), 'moonshotai/kimi-k2.6'))
    const res = await generateStructured<typeof GOOD>({ ...base, route: { provider: 'openrouter', model: 'moonshotai/kimi-k2.6' }, clients: { openrouter: client } })
    expect(res.attempts).toBe(2)
    const retry = (create.mock.calls[1] as any[])[0]
    expect(retry.messages.at(-1).content).toMatch(/Does not match the schema: .*bullets/)
  })

  it('builds requests without temperature for unknown models (conservative default)', () => {
    const body = buildOpenRouterRequest({ model: 'some/new-model', system: 's', messages: [], files: [], schema: SCHEMA, schemaName: 'x', maxTokens: 10, temperature: 0.5 })
    expect(body).not.toHaveProperty('temperature')
    expect(modelInfo('some/new-model').provider).toBe('openrouter')
  })
})

describe('error classification across providers', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  const anthropicError = (status: number, type: string, message: string) =>
    Anthropic.APIError.generate(status, { type: 'error', error: { type, message } } as never, undefined, new Headers() as never)

  it('classifies Anthropic SDK errors and tags the log with the provider', async () => {
    const cases: [any, string][] = [
      [anthropicError(401, 'authentication_error', 'invalid x-api-key'), 'auth'],
      [anthropicError(403, 'permission_error', 'no access'), 'auth'],
      [anthropicError(429, 'rate_limit_error', 'slow down'), 'rate_limit'],
      [anthropicError(529, 'overloaded_error', 'Overloaded'), 'overloaded'],
      [anthropicError(400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API.'), 'quota'],
      [anthropicError(402, 'billing_error', 'billing problem'), 'quota'],
      [anthropicError(500, 'api_error', 'boom'), 'unavailable'],
    ]
    for (const [error, kind] of cases) {
      const { client } = anthropicMock(error)
      const thrown = await generateStructured({ ...base, route: { provider: 'anthropic', model: 'claude-opus-5-5' }, clients: { anthropic: client } }).catch((e) => e)
      expect(thrown.provider).toBe('anthropic')
      expect(classifyAIError(thrown, 'Tailoring').kind).toBe(kind)
    }
    const errorSpy = console.error as unknown as ReturnType<typeof vi.fn>
    expect(errorSpy.mock.calls.some((c) => String(c[0]).includes('ANTHROPIC_QUOTA_EXHAUSTED'))).toBe(true)
  })

  it('treats OpenRouter 402 (no credits) as quota and 429 as a rate limit', async () => {
    for (const [status, kind] of [
      [402, 'quota'],
      [429, 'rate_limit'],
    ] as const) {
      const err = OpenAIAPIError.generate(status, { error: { message: 'x', code: status } } as never, undefined, {} as never)
      const { client } = chatMock(err)
      const thrown = await generateStructured({ ...base, route: { provider: 'openrouter', model: 'moonshotai/kimi-k2.6' }, clients: { openrouter: client } }).catch((e) => e)
      expect(classifyAIError(thrown).kind).toBe(kind)
    }
  })

  it('reports a missing key as not_configured for the right provider', async () => {
    const thrown = await generateStructured({ ...base, route: { provider: 'anthropic', model: 'claude-opus-5-5' } }).catch((e) => e)
    expect(classifyAIError(thrown).kind).toBe('not_configured')
  })
})

describe('routing', () => {
  it('defaults to Opus 5.5 everywhere when ANTHROPIC_API_KEY is set, else the old OpenAI models', () => {
    expect(taskRoute('tailor')).toEqual({ provider: 'openai', model: 'gpt-4o' })
    expect(taskRoute('jobExtract')).toEqual({ provider: 'openai', model: 'gpt-4o-mini' })
    process.env.OPENAI_TAILOR_MODEL = 'gpt-4.1'
    expect(taskRoute('coverLetter').model).toBe('gpt-4.1') // old override still honored
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    for (const task of ['parse', 'jobExtract', 'tailor', 'coverLetter', 'evidence'] as const) {
      expect(taskRoute(task)).toEqual({ provider: 'anthropic', model: 'claude-opus-5-5' })
    }
  })

  it('reads provider:model per task, OpenRouter ids included', () => {
    process.env.AI_COVER_LETTER = 'openrouter:moonshotai/kimi-k2.6'
    expect(taskRoute('coverLetter')).toEqual({ provider: 'openrouter', model: 'moonshotai/kimi-k2.6' })
    expect(parseRoute('nope')).toBeNull()
    expect(parseRoute('free-llm:x')).toBeNull() // unknown providers never route
  })

  it('applies AI_FREE_TIER to FREE users and the 75% downgrade, but never to parse', () => {
    process.env.ANTHROPIC_API_KEY = 'k'
    process.env.AI_FREE_TIER = 'anthropic:claude-sonnet-5-5'
    const sonnet = { provider: 'anthropic', model: 'claude-sonnet-5-5' }
    const opus = { provider: 'anthropic', model: 'claude-opus-5-5' }
    expect(resolveRoute('tailor', { tier: 'free' })).toEqual(sonnet)
    expect(resolveRoute('evidence', { tier: 'free' })).toEqual(sonnet)
    expect(resolveRoute('tailor', { tier: 'pro' })).toEqual(opus)
    expect(resolveRoute('coverLetter', { tier: 'pro', downgraded: true })).toEqual(sonnet)
    expect(resolveRoute('parse', { tier: 'free' })).toEqual(opus)
    expect(resolveRoute('jobExtract', { tier: 'pro', downgraded: true })).toEqual(opus)
    expect(downgradeAvailable()).toBe(true)
  })

  it('routes inside a usage scope by its plan context', async () => {
    process.env.AI_TAILOR = 'anthropic:claude-opus-5-5'
    process.env.AI_FREE_TIER = 'anthropic:claude-sonnet-5-5'
    const { client, create } = anthropicMock(anthropicReply(JSON.stringify(GOOD), { model: 'claude-sonnet-5-5' }))
    const { run, records } = collectUsage(() => generateStructured({ ...base, clients: { anthropic: client } }), { routing: { tier: 'free' } })
    await run
    expect((create.mock.calls[0] as any[])[0].model).toBe('claude-sonnet-5-5')
    expect(records()[0]).toMatchObject({ provider: 'anthropic', model: 'claude-sonnet-5-5', task: 'tailor', ok: true })
  })

  it('shows "Powered by Claude Opus 5.5" only when Pro tailoring is really on it', () => {
    expect(showPoweredBy()).toBe(false)
    process.env.ANTHROPIC_API_KEY = 'k'
    expect(showPoweredBy()).toBe(true)
    process.env.AI_TAILOR = 'anthropic:claude-sonnet-5-5'
    expect(showPoweredBy()).toBe(false)
  })

  it('pins the legacy `client` test hook to the OpenAI adapter', () => {
    process.env.ANTHROPIC_API_KEY = 'k'
    const o = callOverrides('tailor', { client: { fake: true } })
    expect(o.route).toEqual({ provider: 'openai', model: 'gpt-4o' })
    expect(o.clients?.openai).toEqual({ fake: true })
  })
})

describe('parseAndValidate', () => {
  it('names the schema problem', () => {
    expect(parseAndValidate('{"title":"x","bullets":[],"extra":1}', SCHEMA)).toMatchObject({ ok: false, problem: expect.stringMatching(/additional properties/) })
    expect(parseAndValidate(JSON.stringify(GOOD), SCHEMA)).toEqual({ ok: true, data: GOOD })
  })
})
