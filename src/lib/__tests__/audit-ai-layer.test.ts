// Audit (launch-audit branch): the AI layer with a mocked Anthropic client. Refusal,
// truncation, malformed output, repair retry, 429/529, request shape, usage accounting
// and the SDK timeout vs the route's maxDuration. `it.fails` = a bug; the comment says
// what correct behavior is.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateStructured } from '@/lib/ai'
import { AIOutputError, classifyAIError } from '@/lib/ai-errors'
import { collectUsage } from '@/lib/ai-usage'
import { costUsd } from '@/lib/ai/models'
import { anthropicClient, buildAnthropicRequest, FALLBACK_BETA } from '@/lib/ai/adapters/anthropic'
import { callTailorModel, TailorError } from '@/lib/tailor'
import { CoverLetterError, generateCoverLetter } from '@/lib/cover-letter'
import { EvidenceError, generateQuestions } from '@/lib/evidence'
import { ResumeParseError, parseResume } from '@/lib/parse-resume'
import type { TailorInput } from '@/types/tailor'

const OPUS = { provider: 'anthropic' as const, model: 'claude-opus-5-5' }
const SONNET = { provider: 'anthropic' as const, model: 'claude-sonnet-5-5' }
const SCHEMA = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false }

type Reply = { text?: string; stop?: string; model?: string; usage?: any } | Error
function mockClient(replies: Reply[]) {
  const create = vi.fn(async () => {
    const r = replies.shift()
    if (!r) throw new Error('no more replies')
    if (r instanceof Error) throw r
    return {
      model: r.model ?? 'claude-opus-5-5',
      stop_reason: r.stop ?? 'end_turn',
      content: r.text === undefined ? [] : [{ type: 'text', text: r.text }],
      usage: r.usage ?? { input_tokens: 1000, output_tokens: 1000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    }
  })
  return { client: { beta: { messages: { create } } }, create }
}

const req = (client: any, route = OPUS) => ({
  task: 'tailor' as const,
  system: 'sys',
  messages: [{ role: 'user' as const, content: 'hi' }],
  schema: SCHEMA,
  schemaName: 't',
  maxTokens: 8000,
  route,
  clients: { anthropic: client },
})

async function run(replies: Reply[], route = OPUS) {
  const { client, create } = mockClient(replies)
  const c = collectUsage(() => generateStructured<{ ok: boolean }>(req(client, route)))
  const result = await c.run.catch((e) => e)
  return { result, create, records: c.records() }
}

const input: TailorInput = {
  summary: 'Cook.',
  roles: [{ id: 'r', title: 'Cook', company: 'Diner', startDate: '2020', endDate: 'present', location: '', bullets: ['Cooked'] }],
  education: [],
  projects: [],
  skills: [],
  skillGroups: [],
  certifications: [],
}
const job = { title: 'Chef', company: 'Bistro', description: 'Cook food.' }

describe('request shape', () => {
  it('neither model sends a refusal fallback (Anthropic rejected Sonnet 5.5); answer budget gets thinking headroom', () => {
    const base = { system: 's', messages: [{ role: 'user' as const, content: 'x' }], files: [], schema: SCHEMA, schemaName: 't', maxTokens: 8000 }
    const opus = buildAnthropicRequest({ ...base, model: 'claude-opus-5-5' })
    expect(opus.betas).toBeUndefined()
    expect(opus.fallbacks).toBeUndefined()
    expect(opus.max_tokens).toBe(16000)
    expect(opus.temperature).toBeUndefined()
    const sonnet = buildAnthropicRequest({ ...base, model: 'claude-sonnet-5-5' })
    expect(sonnet.fallbacks).toBeUndefined()
    // Cover letters: 1200 answer tokens -> 4400 total including thinking at effort medium.
    expect(buildAnthropicRequest({ ...base, model: 'claude-opus-5-5', maxTokens: 1200 }).max_tokens).toBe(4400)
  })
})

describe('refusal: Opus -> (server-side Sonnet) -> declined', () => {
  it('stop_reason refusal (after the fallback also declined) throws AIOutputError(refusal), no repair, one usage record', async () => {
    const { result, create, records } = await run([{ stop: 'refusal', model: 'claude-sonnet-5-5' }])
    expect(result).toBeInstanceOf(AIOutputError)
    expect(result.reason).toBe('refusal')
    expect(create).toHaveBeenCalledTimes(1)
    expect(records).toHaveLength(1)
  })

  it('tailor shows the declined message (422) and promises no charge', async () => {
    const { client } = mockClient([{ stop: 'refusal' }])
    const err = await callTailorModel(input, job, { route: OPUS, clients: { anthropic: client } }).catch((e) => e)
    expect(err).toBeInstanceOf(TailorError)
    expect(err.status).toBe(422)
    expect(err.userMessage).toBe(
      "The AI wouldn't tailor for this posting. Check that the job description is a real job ad and try again. This didn't count toward your limit."
    )
  })

  it('cover letter shows its declined message (422)', async () => {
    const { client } = mockClient([{ stop: 'refusal' }])
    const err = await generateCoverLetter(
      { master: input, tailoredText: 'Cook', candidateName: 'Pat', job, tone: 'professional' as any },
      { route: OPUS, clients: { anthropic: client } }
    ).catch((e) => e)
    expect(err).toBeInstanceOf(CoverLetterError)
    expect(err.status).toBe(422)
    expect(err.userMessage).toBe('The AI declined to write this letter. Check the job description and try again.')
  })

  // Correct: a refusal should say "declined" (and not invite a paid retry). Evidence maps
  // every AIOutputError, refusal included, to "Something went wrong. Please try again."
  it('evidence interview shows a declined message on refusal', async () => {
    const { client } = mockClient([{ stop: 'refusal' }])
    const cand = { id: 'c1', section: 'roles' as const, entryId: 'r', entryLabel: 'Cook at Diner', index: 0, bullet: 'Cooked', score: 1, reasons: [] }
    const err = await generateQuestions([cand], { route: OPUS, clients: { anthropic: client } }).catch((e) => e)
    expect(err).toBeInstanceOf(EvidenceError)
    expect(err.userMessage).toMatch(/declined/i)
  })

  // Correct: same as above for resume reading. Today a refusal reads as a file problem.
  it('resume parse shows a declined message on refusal', async () => {
    const { client } = mockClient([{ stop: 'refusal' }])
    const err = await parseResume({ kind: 'text', text: 'Pat Cook\nLine Cook at Corner Diner, 2020 to present\nCooked breakfast and lunch for guests every day, kept the line stocked, trained new cooks on prep.' } as any, {
      route: OPUS,
      clients: { anthropic: client },
    }).catch((e) => e)
    expect(err).toBeInstanceOf(ResumeParseError)
    expect(err.kind).toBe('invalid_output') // reached the model, not the length check
    expect(err.userMessage).toMatch(/declined/i)
  })

  // Correct: per the API docs, top-level `usage` covers only the attempt that produced the
  // returned message; `usage.iterations` holds every attempt (a mid-stream Opus decline is
  // billed at Opus rates). The adapter reads only top-level usage and prices it all at
  // `res.model` (Sonnet), so a rescued refusal under-counts spend toward the AI cap.
  it('a server-side fallback bills the declined Opus attempt too (usage.iterations)', async () => {
    const usage = {
      input_tokens: 1000,
      output_tokens: 1000,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      iterations: [
        { type: 'message', model: 'claude-opus-5-5', input_tokens: 1000, output_tokens: 4000 },
        { type: 'fallback_message', model: 'claude-sonnet-5-5', input_tokens: 1000, output_tokens: 1000 },
      ],
    }
    const { result, records } = await run([{ text: '{"ok":true}', model: 'claude-sonnet-5-5', usage }])
    expect(result.data).toEqual({ ok: true })
    const opusPart = costUsd('claude-opus-5-5', { inputTokens: 1000, outputTokens: 4000, cachedInputTokens: 0 })
    expect(records[0].costUsd).toBeGreaterThanOrEqual(opusPart)
  })
})

describe('truncation and malformed output', () => {
  it('stop_reason max_tokens -> AIOutputError(truncated), no repair', async () => {
    const { result, create } = await run([{ text: '{"ok":', stop: 'max_tokens' }])
    expect(result.reason).toBe('truncated')
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('tailor maps truncation to a 400 "too much text" message', async () => {
    const { client } = mockClient([{ text: '{', stop: 'max_tokens' }])
    const err = await callTailorModel(input, job, { route: OPUS, clients: { anthropic: client } }).catch((e) => e)
    expect(err.status).toBe(400)
    expect(err.userMessage).toMatch(/too much text/)
  })

  it('invalid JSON -> one repair retry -> success; both calls recorded (billed once each, no double count)', async () => {
    const { result, create, records } = await run([{ text: 'not json' }, { text: '{"ok":true}' }])
    expect(result.data).toEqual({ ok: true })
    expect(result.attempts).toBe(2)
    expect(create).toHaveBeenCalledTimes(2)
    expect(records.map((r) => r.ok)).toEqual([false, true])
  })

  it('schema mismatch twice -> AIOutputError(invalid) after exactly 2 calls', async () => {
    const { result, create, records } = await run([{ text: '{"nope":1}' }, { text: '{"ok":"yes"}' }])
    expect(result.reason).toBe('invalid')
    expect(create).toHaveBeenCalledTimes(2)
    expect(records).toHaveLength(2)
  })

  it('empty text with end_turn -> AIOutputError(empty), no repair', async () => {
    const { result, create } = await run([{ text: '' }])
    expect(result.reason).toBe('empty')
    expect(create).toHaveBeenCalledTimes(1)
  })

  // Correct: `model_context_window_exceeded` (and `pause_turn`) are not a finished answer.
  // The adapter maps every unknown stop_reason to 'stop', so a cut-off answer gets a paid
  // repair call that resends an even longer prompt.
  it('model_context_window_exceeded is treated as truncation, not repaired', async () => {
    const { result, create } = await run([{ text: '{"ok":', stop: 'model_context_window_exceeded' }, { text: '{"ok":true}' }])
    expect(create).toHaveBeenCalledTimes(1)
    expect(result.reason).toBe('truncated')
  })
})

describe('provider errors', () => {
  it('429 and 529 propagate tagged with the provider and classify as "busy, try again"', async () => {
    const r429 = await run([Object.assign(new Error('rate_limit_error'), { status: 429, error: { type: 'rate_limit_error' } })])
    expect(r429.result.provider).toBe('anthropic')
    expect(r429.records).toHaveLength(0) // nothing billed, nothing recorded
    const c429 = classifyAIError(r429.result, 'Tailoring')
    expect(c429).toMatchObject({ kind: 'rate_limit', status: 429, retryable: true })
    const r529 = await run([Object.assign(new Error('Overloaded'), { status: 529, error: { type: 'overloaded_error' } })])
    expect(classifyAIError(r529.result, 'Tailoring')).toMatchObject({ kind: 'overloaded', status: 503 })
  })

  it('a 402/credit error is "temporarily unavailable", not retryable', () => {
    const c = classifyAIError({ status: 400, message: 'Your credit balance is too low', provider: 'anthropic' }, 'Tailoring')
    expect(c).toMatchObject({ kind: 'quota', retryable: false })
  })
})

describe('SDK timeout vs route maxDuration (300 s)', () => {
  const saved = process.env.ANTHROPIC_API_KEY
  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = saved
  })
  // Correct: the whole call, retries included, must finish (or fail with our own message)
  // before Vercel kills the function at 300 s. Today the client uses the SDK default
  // timeout (600 s, scaled UP for large non-streaming max_tokens) with maxRetries 2, so
  // the wall clock can reach 3 x 600 s. At 300 s Vercel kills the lambda: no ai_call event
  // (untracked spend), no reservation refund (the route's finally never runs), and the
  // client gets a cut-off stream.
  // Fixed on launch-audit: routes also pass the time left as a per-request timeout.
  it('timeout x (maxRetries + 1) fits inside maxDuration', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    const c: any = anthropicClient()
    expect(c.timeout * (c.maxRetries + 1)).toBeLessThan(300_000)
  })
})

describe('routing note', () => {
  it('FREE tier only changes plan tasks; parse and job extraction stay on the task route', async () => {
    const { resolveRoute } = await import('@/lib/ai/routing')
    const saved = process.env.ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    try {
      expect(resolveRoute('tailor', { tier: 'free' })).toEqual(SONNET)
      expect(resolveRoute('parse', { tier: 'free' })).toEqual(OPUS) // FREE parse runs on Opus
      expect(resolveRoute('jobExtract', { tier: 'free' })).toEqual(OPUS)
      expect(resolveRoute('parse', { tier: 'pro', downgraded: true })).toEqual(OPUS) // 75% band doesn't touch parse
    } finally {
      process.env.ANTHROPIC_API_KEY = saved
    }
  })
})
