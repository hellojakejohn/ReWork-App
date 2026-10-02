// Every model we know how to call, with its price. One table: the router, the cost
// estimates on events, the admin spend page, the AI cap and the eval all read it.
//
// Prices are USD per 1M tokens. They are an ESTIMATE for our own bookkeeping, not
// billing: the provider dashboards have the real number. Check `priceAsOf` and `source`
// before trusting a row, and update both when a price changes.
//
// Safe to import from client components (no SDKs, no env).

export type ProviderId = 'anthropic' | 'openai' | 'openrouter'

export interface ModelInfo {
  id: string
  provider: ProviderId
  label: string // short user-facing name, e.g. "Opus 5.5"
  input: number // $ per 1M uncached input tokens
  output: number // $ per 1M output tokens (thinking tokens bill as output)
  cachedInput: number // $ per 1M cache-read input tokens
  cacheWrite?: number // $ per 1M cache-write tokens (Anthropic: 1.25x input for the 5-minute TTL)
  priceAsOf: string
  source: string
  // Sampling: newer reasoning models reject a non-default temperature with a 400.
  temperature: boolean
  // Can take a PDF directly (Anthropic document block / OpenAI file input).
  pdf: boolean
  // Native strict JSON-schema output. Without it we use JSON mode + validation + repair.
  strictSchema: boolean
  // OpenAI only: reasoning models take max_completion_tokens instead of max_tokens.
  maxCompletionTokens?: boolean
  // Anthropic only: send `fallbacks: "default"` so a safety-classifier decline is re-run
  // server-side on Anthropic's recommended fallback model instead of failing the call.
  refusalFallback?: boolean
}

const ANTHROPIC_PRICING = 'https://platform.claude.com/docs/en/about-claude/pricing'

export const MODELS: Record<string, ModelInfo> = {
  'claude-opus-5-5': {
    id: 'claude-opus-5-5',
    provider: 'anthropic',
    label: 'Opus 5.5',
    input: 4,
    output: 20,
    cachedInput: 0.2,
    cacheWrite: 5,
    priceAsOf: '2026-10-01',
    source: ANTHROPIC_PRICING,
    temperature: false, // removed on Opus 5.5: any temperature is a 400
    pdf: true,
    strictSchema: true,
    refusalFallback: true,
  },
  'claude-sonnet-5-5': {
    id: 'claude-sonnet-5-5',
    provider: 'anthropic',
    label: 'Sonnet 5.5',
    input: 2,
    output: 10,
    cachedInput: 0.2,
    cacheWrite: 2.5,
    priceAsOf: '2026-10-01',
    source: ANTHROPIC_PRICING,
    temperature: false, // non-default values are a 400 on Sonnet 5.5
    pdf: true,
    strictSchema: true,
    refusalFallback: true,
  },
  // Not routed to; here so a refusal fallback served by it is priced right.
  'claude-opus-4-8': {
    id: 'claude-opus-4-8',
    provider: 'anthropic',
    label: 'Opus 4.8',
    input: 5,
    output: 25,
    cachedInput: 0.5,
    cacheWrite: 6.25,
    priceAsOf: '2026-10-01',
    source: ANTHROPIC_PRICING,
    temperature: false,
    pdf: true,
    strictSchema: true,
  },
  'gpt-4o': {
    id: 'gpt-4o',
    provider: 'openai',
    label: 'GPT-4o',
    input: 2.5,
    output: 10,
    cachedInput: 1.25,
    priceAsOf: '2026-10-01',
    source: 'https://openai.com/api/pricing/',
    temperature: true,
    pdf: true,
    strictSchema: true,
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    provider: 'openai',
    label: 'GPT-4o mini',
    input: 0.15,
    output: 0.6,
    cachedInput: 0.075,
    priceAsOf: '2026-10-01',
    source: 'https://openai.com/api/pricing/',
    temperature: true,
    pdf: true,
    strictSchema: true,
  },
  // Current OpenAI mini. Price from third-party price trackers (openai.com was not
  // reachable when this was written): verify on the OpenAI pricing page.
  'gpt-5.4-mini': {
    id: 'gpt-5.4-mini',
    provider: 'openai',
    label: 'GPT-5.4 mini',
    input: 0.75,
    output: 4.5,
    cachedInput: 0.075,
    priceAsOf: '2026-10-02',
    source: 'https://benchlm.ai/openai/api-pricing (unverified, check https://openai.com/api/pricing/)',
    temperature: false, // reasoning model: only the default temperature
    pdf: true,
    strictSchema: true,
    maxCompletionTokens: true,
  },
  // OpenRouter passes through the provider's price. Text only, JSON mode.
  'moonshotai/kimi-k2.6': {
    id: 'moonshotai/kimi-k2.6',
    provider: 'openrouter',
    label: 'Kimi K2.6',
    input: 0.4342,
    output: 1.828,
    cachedInput: 0.07312,
    priceAsOf: '2026-10-02',
    source: 'https://openrouter.ai/moonshotai/kimi-k2.6 (varies by upstream provider)',
    temperature: true,
    pdf: false,
    strictSchema: false,
  },
}

// Unknown model: price it like Opus 5.5 so estimates (and the AI cap) err high.
const FALLBACK_PRICE = { input: 4, output: 20, cachedInput: 0.2 }

/**
 * Model info by id. Dated snapshots ("gpt-4o-2024-08-06") and OpenRouter ids match their
 * family by longest prefix. Unknown ids get conservative defaults: priced high, no
 * temperature, no PDF, no strict schema.
 */
export function modelInfo(id: string, provider?: ProviderId): ModelInfo {
  const exact = MODELS[id]
  if (exact) return exact
  const family = Object.values(MODELS)
    .filter((m) => id.startsWith(m.id))
    .sort((a, b) => b.id.length - a.id.length)[0]
  if (family) return { ...family, id }
  const p = provider ?? (id.startsWith('claude') ? 'anthropic' : id.includes('/') ? 'openrouter' : 'openai')
  return {
    id,
    provider: p,
    label: id,
    ...FALLBACK_PRICE,
    priceAsOf: 'unknown',
    source: 'fallback (unknown model, priced like Opus 5.5)',
    temperature: false,
    pdf: p !== 'openrouter',
    strictSchema: p !== 'openrouter',
  }
}

export interface TokenUsage {
  inputTokens: number // uncached input
  outputTokens: number
  cachedInputTokens: number // cache reads
  cacheWriteTokens?: number
}

/** Estimated USD for one call, rounded to 1e-6. */
export function costUsd(model: string, usage: TokenUsage): number {
  const m = modelInfo(model)
  const total =
    (usage.inputTokens * m.input +
      usage.outputTokens * m.output +
      usage.cachedInputTokens * m.cachedInput +
      (usage.cacheWriteTokens ?? 0) * (m.cacheWrite ?? m.input)) /
    1_000_000
  return Math.round(total * 1_000_000) / 1_000_000
}

export function modelLabel(id: string): string {
  return modelInfo(id).label
}
