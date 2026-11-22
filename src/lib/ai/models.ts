// Every model we know how to call, with its price. One table: the router, the cost
// estimates on events, the admin spend page, the AI cap and the eval all read it.
//
// Prices are USD per 1M tokens. They are an ESTIMATE for our own bookkeeping, not
// billing: the provider dashboards have the real number. Check `priceAsOf` and `source`
// before trusting a row, and update both when a price changes.
//
// Safe to import from client components (no SDKs, no env).

// Anthropic is the only provider (OpenAI and OpenRouter were removed Nov 2026).
export type ProviderId = 'anthropic'

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
  // Can take a PDF directly (Anthropic document block).
  pdf: boolean
  // Native strict JSON-schema output. Without it we use JSON mode + validation + repair.
  strictSchema: boolean
  // The model a safety-classifier decline is re-run on, server-side, inside
  // the same call (beta server-side-fallback). Always another Anthropic model: resume text
  // never crosses to a different provider because of a refusal. No entry = no fallback.
  refusalFallback?: string
  // App-side retry when this model declines: one normal call on this Anthropic model
  // (src/lib/ai/index.ts). Used because Anthropic accepts no server-side fallback for
  // Opus 5.5 or Sonnet 5.5 (allowed_fallback_models is null for both, 2026-10-28).
  refusalRetry?: string
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
    // No server-side fallback: Anthropic rejects claude-sonnet-5-5 as one (400 in prod,
    // 2026-10-28). A decline is retried once on Sonnet by the app instead.
    refusalRetry: 'claude-sonnet-5-5',
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
    // No fallback or retry: a Sonnet decline surfaces as the feature's "we couldn't" message.
  },
  // Not routed to or used as a fallback. Kept so old ai_call events and any served-by
  // model we don't route to are priced right.
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
}

// Unknown model: price it like Opus 5.5 so estimates (and the AI cap) err high.
const FALLBACK_PRICE = { input: 4, output: 20, cachedInput: 0.2 }

/**
 * Model info by id. Dated snapshots ("claude-opus-5-5-20261001") match their family by
 * longest prefix. Unknown ids (old non-Claude rows in events) get conservative defaults:
 * priced high, no temperature.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function modelInfo(id: string, _provider?: ProviderId): ModelInfo {
  const exact = MODELS[id]
  if (exact) return exact
  const family = Object.values(MODELS)
    .filter((m) => id.startsWith(m.id))
    .sort((a, b) => b.id.length - a.id.length)[0]
  if (family) return { ...family, id }
  return {
    id,
    provider: 'anthropic',
    label: id,
    ...FALLBACK_PRICE,
    priceAsOf: 'unknown',
    source: 'fallback (unknown model, priced like Opus 5.5)',
    temperature: false,
    pdf: true,
    strictSchema: true,
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
