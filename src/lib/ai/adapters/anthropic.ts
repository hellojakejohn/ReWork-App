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
// - Refusals: `fallbacks: "default"` (beta server-side-fallback-2026-07-01) re-runs a
//   safety-classifier decline on Anthropic's recommended fallback model server-side.
import Anthropic from '@anthropic-ai/sdk'
import { modelInfo } from '@/lib/ai/models'
import type { Adapter, AdapterRequest, AdapterResult } from '@/lib/ai/types'

// Non-streaming requests stay at or under 16k so the SDK's HTTP timeout logic is happy.
const MAX_NON_STREAMING = 16_000
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

export function anthropicMaxTokens(answerTokens: number): number {
  return Math.min(MAX_NON_STREAMING, answerTokens * 2 + 2000)
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function buildAnthropicRequest(req: AdapterRequest): Record<string, any> {
  const info = modelInfo(req.model, 'anthropic')
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
    ...(info.refusalFallback ? { betas: [FALLBACK_BETA], fallbacks: 'default' } : {}),
  }
}

let defaultClient: Anthropic | null = null
export function anthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')
  defaultClient ??= new Anthropic({ apiKey, maxRetries: 2 })
  return defaultClient
}

export const anthropicAdapter: Adapter = {
  provider: 'anthropic',
  async call(req, client): Promise<AdapterResult> {
    const c = (client ?? anthropicClient()) as any
    const res = await c.beta.messages.create(buildAnthropicRequest(req))
    const text = (res.content ?? [])
      .filter((b: any) => b?.type === 'text')
      .map((b: any) => b.text)
      .join('')
    const stop = res.stop_reason === 'max_tokens' ? 'length' : res.stop_reason === 'refusal' ? 'refusal' : 'stop'
    return {
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
