// One tiny real call per configured provider for /api/health. A real call (not a models
// lookup) because an account out of credit only shows up when you try to generate.
import { classifyAIError, errorCodes, type AIErrorKind } from '@/lib/ai-errors'
import { modelInfo, type ProviderId } from '@/lib/ai/models'
import { allRoutes, PROVIDER_KEY_ENV, PROVIDERS, providerConfigured, type ModelRoute } from '@/lib/ai/routing'
import { anthropicClient, buildAnthropicRequest } from '@/lib/ai/adapters/anthropic'
import { refusalRetryFor } from '@/lib/ai'
import { openAIClient } from '@/lib/ai/adapters/openai'
import { openRouterClient } from '@/lib/ai/adapters/openrouter'

export interface ProviderCheck {
  configured: boolean
  used: boolean // some task (or AI_FREE_TIER) routes here
  ok: boolean
  model?: string
  ms?: number
  kind?: AIErrorKind
  detail?: string
  // Anthropic only: each routed model's accepted `fallbacks[i].model` ids (GET /v1/models),
  // so a refusal fallback is picked from what Anthropic allows. [] = fallbacks unsupported.
  allowedFallbacks?: Record<string, string[] | null | string>
  // Every other routed model on this provider, plus refusal-retry targets (Sonnet 5.5 for
  // the free tier and Opus declines). `ok` above is false if any of these fail.
  others?: Record<string, { ok: boolean; ms: number; detail?: string }>
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function ping(route: ModelRoute): Promise<string> {
  const messages = [{ role: 'user', content: 'Reply with OK.' }]
  if (route.provider === 'anthropic') {
    // The exact production request shape (structured output, plus the refusal fallback
    // beta when a model has one): a fallback Anthropic rejects makes every call a 400, and
    // this check has to see that too.
    const body = buildAnthropicRequest({
      model: route.model,
      system: 'Health check.',
      messages: [{ role: 'user', content: 'Reply with {"ok": true}.' }],
      files: [],
      schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false },
      schemaName: 'health',
      maxTokens: 32,
      effort: 'low',
    })
    const res = await (anthropicClient() as any).beta.messages.create(body)
    return res.model
  }
  const client: any = route.provider === 'openai' ? openAIClient() : openRouterClient()
  const tokens = modelInfo(route.model, route.provider).maxCompletionTokens ? { max_completion_tokens: 32 } : { max_tokens: 1 }
  const res = await client.chat.completions.create({ model: route.model, ...tokens, messages })
  return res.model
}

function describe(error: unknown, provider: ProviderId): { kind: AIErrorKind; detail: string } {
  if (error && typeof error === 'object') Object.assign(error, { provider })
  const classified = classifyAIError(error, 'Health check')
  const codes = errorCodes(error)
  return {
    kind: classified.kind,
    detail: `${classified.kind}${codes.length ? ` (${[...new Set(codes)].join(', ')})` : ''}: ${String((error as Error)?.message || '').slice(0, 200)}`,
  }
}

/** Pings each extra model; never throws. */
async function pingOthers(provider: ProviderId, models: string[]): Promise<ProviderCheck['others']> {
  if (models.length === 0) return undefined
  const out: NonNullable<ProviderCheck['others']> = {}
  await Promise.all(
    models.map(async (model) => {
      const start = Date.now()
      try {
        await ping({ provider, model })
        out[model] = { ok: true, ms: Date.now() - start }
      } catch (error) {
        out[model] = { ok: false, ms: Date.now() - start, detail: describe(error, provider).detail }
      }
    })
  )
  return out
}

/** Accepted fallback ids per routed Anthropic model; an error string per model it couldn't read. */
async function anthropicFallbacks(models: string[]): Promise<Record<string, string[] | null | string>> {
  const out: Record<string, string[] | null | string> = {}
  await Promise.all(
    models.map(async (id) => {
      try {
        out[id] = (await anthropicClient().beta.models.retrieve(id)).allowed_fallback_models ?? null
      } catch (error) {
        out[id] = `unreadable: ${String((error as Error)?.message || '').slice(0, 120)}`
      }
    })
  )
  return out
}

/** Checks every provider that has a key or a route. Never throws. */
export async function checkProviders(): Promise<Record<ProviderId, ProviderCheck>> {
  const routes = Object.values(allRoutes()).filter((r): r is ModelRoute => !!r)
  const entries = await Promise.all(
    PROVIDERS.map(async (provider): Promise<[ProviderId, ProviderCheck]> => {
      const configured = providerConfigured(provider)
      // Prefer the top model (Opus): its requests carry the fallback, the riskier shape.
      const mine = routes.filter((r) => r.provider === provider)
      const route = mine.find((r) => /opus/.test(r.model)) ?? mine[0]
      const used = !!route
      if (!configured) {
        return [provider, { configured, used, ok: !used, kind: used ? 'not_configured' : undefined, detail: `${PROVIDER_KEY_ENV[provider]} is not set` }]
      }
      // A key with no route still gets checked, on a cheap known model.
      const model = route?.model ?? { anthropic: 'claude-sonnet-5-5', openai: 'gpt-4o-mini', openrouter: 'moonshotai/kimi-k2.6' }[provider]
      const fallbacks =
        provider === 'anthropic' ? anthropicFallbacks([...new Set([model, ...mine.map((r) => r.model)])]) : Promise.resolve(undefined)
      const retries = mine.map((r) => refusalRetryFor(r)?.model).filter((m): m is string => !!m)
      const others = pingOthers(provider, [...new Set([...mine.map((r) => r.model), ...retries])].filter((m) => m !== model))
      const start = Date.now()
      try {
        const served = await ping({ provider, model })
        const rest = await others
        const ok = Object.values(rest ?? {}).every((o) => o.ok)
        return [provider, { configured, used, ok, model: served || model, ms: Date.now() - start, allowedFallbacks: await fallbacks, others: rest }]
      } catch (error) {
        return [
          provider,
          { configured, used, ok: false, model, ms: Date.now() - start, ...describe(error, provider), allowedFallbacks: await fallbacks, others: await others },
        ]
      }
    })
  )
  return Object.fromEntries(entries) as Record<ProviderId, ProviderCheck>
}
