// Token usage per request, for the admin page's OpenAI spend estimate.
//
// Every model call site calls recordUsage(completion). A route wraps its work in
// collectUsage(), which gathers those calls (AsyncLocalStorage, so nothing has to be
// threaded through the libs) and returns totals to put on the request's event.
// Outside collectUsage() recordUsage() is a no-op, so tests and scripts don't care.
import { AsyncLocalStorage } from 'node:async_hooks'

export interface UsageRecord {
  model: string
  tokensIn: number
  tokensOut: number
}

export interface UsageSummary {
  model?: string // the last model used, e.g. "gpt-4o-2024-08-06"
  calls: number
  tokensIn: number
  tokensOut: number
  costUsd: number // estimate, see PRICES
}

// USD per 1M tokens [input, output], from OpenAI's public pricing page. An ESTIMATE for
// the admin page, not billing: check the OpenAI usage dashboard for the real number.
// Longest prefix wins, so dated snapshots ("gpt-4o-2024-08-06") match their family.
const PRICES: [prefix: string, input: number, output: number][] = [
  ['gpt-4o-mini', 0.15, 0.6],
  ['gpt-4o', 2.5, 10],
  ['gpt-4.1-nano', 0.1, 0.4],
  ['gpt-4.1-mini', 0.4, 1.6],
  ['gpt-4.1', 2, 8],
]
// Unknown model: price it like gpt-4o so the estimate errs high.
const FALLBACK: [number, number] = [2.5, 10]

export function priceFor(model: string): [number, number] {
  const match = PRICES.filter(([prefix]) => model.startsWith(prefix)).sort((a, b) => b[0].length - a[0].length)[0]
  return match ? [match[1], match[2]] : FALLBACK
}

export function estimateCostUsd(records: UsageRecord[]): number {
  const total = records.reduce((sum, r) => {
    const [input, output] = priceFor(r.model)
    return sum + (r.tokensIn * input + r.tokensOut * output) / 1_000_000
  }, 0)
  return Math.round(total * 1_000_000) / 1_000_000
}

export function summarize(records: UsageRecord[]): UsageSummary {
  return {
    model: records.at(-1)?.model,
    calls: records.length,
    tokensIn: records.reduce((s, r) => s + r.tokensIn, 0),
    tokensOut: records.reduce((s, r) => s + r.tokensOut, 0),
    costUsd: estimateCostUsd(records),
  }
}

const store = new AsyncLocalStorage<UsageRecord[]>()

interface CompletionLike {
  model?: string
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null
}

export function recordUsage(completion: CompletionLike | null | undefined, fallbackModel = 'unknown'): void {
  const records = store.getStore()
  if (!records || !completion) return
  records.push({
    model: completion.model || fallbackModel,
    tokensIn: completion.usage?.prompt_tokens ?? 0,
    tokensOut: completion.usage?.completion_tokens ?? 0,
  })
}

/**
 * Runs `fn` and collects the usage of every model call inside it. `usage` is filled in
 * even when `fn` throws (a failed call can still cost tokens), so read it in a finally.
 */
export function collectUsage<T>(fn: () => Promise<T>): { run: Promise<T>; usage: () => UsageSummary } {
  const records: UsageRecord[] = []
  return { run: store.run(records, fn), usage: () => summarize(records) }
}

/** Usage as flat event props (only when a model was actually called). */
export function usageProps(summary: UsageSummary): Record<string, string | number> {
  if (summary.calls === 0) return {}
  return {
    model: summary.model ?? 'unknown',
    aiCalls: summary.calls,
    tokensIn: summary.tokensIn,
    tokensOut: summary.tokensOut,
    costUsd: summary.costUsd,
  }
}
