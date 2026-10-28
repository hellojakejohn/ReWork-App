// Token usage and estimated cost per model call.
//
// generateStructured() (src/lib/ai/) calls recordUsage() after every provider call. A
// route wraps its AI work in collectUsage(), which gathers those calls (AsyncLocalStorage,
// so nothing has to be threaded through the libs) and also carries the user's routing
// context (plan tier, 75% downgrade) down to the router. Outside collectUsage()
// recordUsage() is a no-op, so tests and scripts don't care.
//
// Prices come from src/lib/ai/models.ts. Estimates for the admin page and the AI cap,
// not billing: the provider dashboards have the real number.
import { AsyncLocalStorage } from 'node:async_hooks'
import { costUsd, type ProviderId } from '@/lib/ai/models'
import type { AITask, RoutingContext } from '@/lib/ai/routing'

export interface UsageRecord {
  provider: ProviderId
  model: string
  task?: AITask
  tokensIn: number // uncached input
  tokensOut: number
  cachedIn: number // cache reads
  cacheWrite?: number
  costUsd: number
  ms?: number
  ok?: boolean // false when the answer was unusable (still billed)
}

export interface UsageSummary {
  model?: string // the last model used, e.g. "claude-opus-5-5"
  provider?: ProviderId
  calls: number
  tokensIn: number
  tokensOut: number
  cachedIn: number
  costUsd: number
}

export function summarize(records: UsageRecord[]): UsageSummary {
  return {
    model: records.at(-1)?.model,
    provider: records.at(-1)?.provider,
    calls: records.length,
    tokensIn: records.reduce((s, r) => s + r.tokensIn, 0),
    tokensOut: records.reduce((s, r) => s + r.tokensOut, 0),
    cachedIn: records.reduce((s, r) => s + r.cachedIn, 0),
    costUsd: Math.round(records.reduce((s, r) => s + r.costUsd, 0) * 1_000_000) / 1_000_000,
  }
}

export interface UsageScope {
  routing?: RoutingContext
  // Called once per provider call (src/lib/ai/scope.ts logs it as an ai_call event).
  onCall?: (record: UsageRecord) => void
}

interface Store {
  records: UsageRecord[]
  scope: UsageScope
}

const store = new AsyncLocalStorage<Store>()

/** Builds a record from token counts (cost from models.ts). */
export function usageRecord(
  provider: ProviderId,
  model: string,
  usage: { inputTokens: number; outputTokens: number; cachedInputTokens: number; cacheWriteTokens?: number },
  extra: Partial<Pick<UsageRecord, 'task' | 'ms' | 'ok'>> = {}
): UsageRecord {
  return {
    provider,
    model,
    tokensIn: usage.inputTokens,
    tokensOut: usage.outputTokens,
    cachedIn: usage.cachedInputTokens,
    ...(usage.cacheWriteTokens ? { cacheWrite: usage.cacheWriteTokens } : {}),
    costUsd: costUsd(model, usage),
    ...extra,
  }
}

export function recordUsage(record: UsageRecord): void {
  const s = store.getStore()
  if (!s) return
  s.records.push(record)
  s.scope.onCall?.(record)
}

/** The routing context of the current collectUsage() scope, if any. */
export function currentRouting(): RoutingContext | undefined {
  return store.getStore()?.scope.routing
}

/**
 * Runs `fn` and collects the usage of every model call inside it. `usage` is filled in
 * even when `fn` throws (a failed call can still cost tokens), so read it in a finally.
 */
export function collectUsage<T>(fn: () => Promise<T>, scope: UsageScope = {}): { run: Promise<T>; usage: () => UsageSummary; records: () => UsageRecord[] } {
  const records: UsageRecord[] = []
  return { run: store.run({ records, scope }, fn), usage: () => summarize(records), records: () => [...records] }
}

/**
 * Usage as flat event props (only when a model was actually called). No costUsd: cost is
 * logged once per call on its own ai_call event, so summing costUsd over events never
 * double counts.
 */
export function usageProps(summary: UsageSummary): Record<string, string | number> {
  if (summary.calls === 0) return {}
  return {
    model: summary.model ?? 'unknown',
    ...(summary.provider ? { provider: summary.provider } : {}),
    aiCalls: summary.calls,
    tokensIn: summary.tokensIn,
    tokensOut: summary.tokensOut,
    cachedIn: summary.cachedIn,
  }
}
