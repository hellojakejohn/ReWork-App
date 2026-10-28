// Anthropic (Claude) via @anthropic-ai/sdk.
//
// - Structured output: output_config.format (JSON schema). The old `output_format` param
//   is deprecated and 400s without its beta header.
// - PDFs: base64 `document` blocks before the text (32 MB request cap).
// - Prompt caching: cache_control on the system prompt. Prompts under the model's
//   minimum cacheable length just don't cache (no error, cache_read stays 0).
// - Opus 5.5 / Sonnet 5.5 think on every call and reject temperature; `effort` controls
//   depth. Thinking tokens bill as output and count toward max_tokens, so the answer
//   budget gets headroom.
// - Refusals: a safety-classifier decline is re-run server-side on the model's named
//   Anthropic fallback (models.ts refusalFallback: Opus 5.5 -> Sonnet 5.5), using the
//   array form of `fallbacks` (beta server-side-fallback-2026-06-01). Same provider only:
//   resume text never goes to OpenAI or OpenRouter because Claude declined.
import Anthropic from '@anthropic-ai/sdk'
import { costUsd, modelInfo } from '@/lib/ai/models'
import type { Adapter, AdapterRequest, AdapterResult } from '@/lib/ai/types'

// Non-streaming requests stay at or under 16k so the SDK's HTTP timeout logic is happy.
const MAX_NON_STREAMING = 16_000
export const FALLBACK_BETA = 'server-side-fallback-2026-06-01'

/** The refusal fallback for a model, or null. Only ever an Anthropic model. */
export function refusalFallbackFor(model: string): string | null {
  const fallback = modelInfo(model, 'anthropic').refusalFallback
  if (!fallback || fallback === model) return null
  return modelInfo(fallback).provider === 'anthropic' && fallback.startsWith('claude-') ? fallback : null
}

export function anthropicMaxTokens(answerTokens: number): number {
  return Math.min(MAX_NON_STREAMING, answerTokens * 2 + 2000)
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function buildAnthropicRequest(req: AdapterRequest): Record<string, any> {
  const info = modelInfo(req.model, 'anthropic')
  const fallback = refusalFallbackFor(req.model)
  const messages = req.messages.map((m, i) => {
    if (i !== 0 || m.role !== 'user' || req.files.length === 0) return { role: m.role, content: m.content }
    return {
      role: 'user',
      content: [
        ...req.files.map((f) => ({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: f.data.toString('base64') },
          title: f.filename,
        })),
        { type: 'text', text: m.content },
      ],
    }
  })
  return {
    model: req.model,
    max_tokens: anthropicMaxTokens(req.maxTokens),
    system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
    messages,
    output_config: {
      format: { type: 'json_schema', schema: req.schema },
      ...(req.effort ? { effort: req.effort } : {}),
    },
    ...(info.temperature && req.temperature !== undefined ? { temperature: req.temperature } : {}),
    ...(fallback ? { betas: [FALLBACK_BETA], fallbacks: [{ model: fallback }] } : {}),
  }
}

let defaultClient: Anthropic | null = null
export function anthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')
  // Every AI route has maxDuration 300. The SDK default (600s, x3 attempts) outlived the
  // function, which then died before releasing the user's quota or logging the spend.
  // Routes pass their own deadline per request (AdapterRequest.timeoutMs); this default
  // covers scripts and still fits in 300s with one retry.
  defaultClient ??= new Anthropic({ apiKey, timeout: 140_000, maxRetries: 1 })
  return defaultClient
}

export const anthropicAdapter: Adapter = {
  provider: 'anthropic',
  async call(req, client): Promise<AdapterResult> {
    const c = (client ?? anthropicClient()) as any
    const options = req.timeoutMs ? { timeout: req.timeoutMs, maxRetries: 0 } : undefined
    const res = await c.beta.messages.create(buildAnthropicRequest(req), options)
    const text = (res.content ?? [])
      .filter((b: any) => b?.type === 'text')
      .map((b: any) => b.text)
      .join('')
    // Anything that isn't a finished turn is an incomplete answer (max_tokens,
    // model_context_window_exceeded, pause_turn): don't parse it or pay to repair it.
    const stop = res.stop_reason === 'refusal' ? 'refusal' : res.stop_reason === 'end_turn' || res.stop_reason === 'stop_sequence' ? 'stop' : 'length'
    // With a server-side fallback, top-level usage covers only the final attempt;
    // usage.iterations has every attempt, each billed at its own model's price.
    const iterations: any[] = Array.isArray(res.usage?.iterations) ? res.usage.iterations : []
    const billed =
      iterations.length > 1
        ? iterations.reduce(
            (sum, it) =>
              sum +
              costUsd(it.model || res.model || req.model, {
                inputTokens: it.input_tokens ?? 0,
                outputTokens: it.output_tokens ?? 0,
                cachedInputTokens: it.cache_read_input_tokens ?? 0,
                cacheWriteTokens: it.cache_creation_input_tokens ?? 0,
              }),
            0
          )
        : undefined
    return {
      ...(billed !== undefined ? { costUsd: billed } : {}),
      text,
      stop,
      model: res.model || req.model,
      usage: {
        inputTokens: res.usage?.input_tokens ?? 0,
        outputTokens: res.usage?.output_tokens ?? 0,
        cachedInputTokens: res.usage?.cache_read_input_tokens ?? 0,
        cacheWriteTokens: res.usage?.cache_creation_input_tokens ?? 0,
      },
    }
  },
}
