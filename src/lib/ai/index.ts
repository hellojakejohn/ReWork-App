// The one way the app calls a model: generateStructured({ task, system, messages, schema }).
//
// Picks the provider/model for the task (src/lib/ai/routing.ts, plus the user's plan and
// AI-cap band from the surrounding collectUsage() scope), calls the adapter, parses the
// JSON, validates it against the schema, and runs ONE repair retry if it's invalid. Every
// provider call is recorded with tokens and estimated cost (src/lib/ai-usage.ts).
//
// Errors: provider/SDK errors are rethrown tagged with `provider` so classifyAIError()
// (src/lib/ai-errors.ts) can name it; unusable answers throw AIOutputError.
import Ajv, { type ValidateFunction } from 'ajv'
import { AIOutputError } from '@/lib/ai-errors'
import { currentRouting, recordUsage, usageRecord } from '@/lib/ai-usage'
import { costUsd, modelInfo, type ProviderId, type TokenUsage } from '@/lib/ai/models'
import { resolveRoute, taskRoute } from '@/lib/ai/routing'
import { anthropicAdapter } from '@/lib/ai/adapters/anthropic'
import { openAIAdapter } from '@/lib/ai/adapters/openai'
import { openRouterAdapter } from '@/lib/ai/adapters/openrouter'
import type { Adapter, AdapterRequest, AdapterResult, AIMessage, JsonSchema, StructuredRequest, StructuredResult } from '@/lib/ai/types'

export type { StructuredRequest, StructuredResult, AIFile, AIMessage, ProviderClients, JsonSchema } from '@/lib/ai/types'
export type { AITask, ModelRoute } from '@/lib/ai/routing'

export const ADAPTERS: Record<ProviderId, Adapter> = {
  anthropic: anthropicAdapter,
  openai: openAIAdapter,
  openrouter: openRouterAdapter,
}

const ajv = new Ajv({ allErrors: true, strict: false })
const validators = new WeakMap<object, ValidateFunction>()
function validatorFor(schema: JsonSchema): ValidateFunction {
  let v = validators.get(schema)
  if (!v) {
    v = ajv.compile(schema)
    validators.set(schema, v)
  }
  return v
}

/** Strips a ```json fence some JSON-mode models wrap their answer in. */
function unfence(text: string): string {
  const t = text.trim()
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1] : t
}

export type ParseOutcome<T> = { ok: true; data: T } | { ok: false; problem: string }

/** JSON.parse + schema validation. Exported for tests. */
export function parseAndValidate<T>(text: string, schema: JsonSchema): ParseOutcome<T> {
  let data: unknown
  try {
    data = JSON.parse(unfence(text))
  } catch (error) {
    return { ok: false, problem: `Not valid JSON (${(error as Error).message}).` }
  }
  const validate = validatorFor(schema)
  if (!validate(data)) {
    const errors = (validate.errors ?? []).slice(0, 8).map((e) => `${e.instancePath || '(root)'} ${e.message}`)
    return { ok: false, problem: `Does not match the schema: ${errors.join('; ')}.` }
  }
  return { ok: true, data: data as T }
}

function repairMessages(messages: AIMessage[], badText: string, problem: string): AIMessage[] {
  return [
    ...messages,
    { role: 'assistant', content: badText.slice(0, 20_000) || '(empty)' },
    {
      role: 'user',
      content: `That answer can't be used. ${problem} Return the complete corrected JSON object only, following the same rules and schema. Do not add any facts that were not in your sources.`,
    },
  ]
}

const add = (a: TokenUsage, b: TokenUsage): TokenUsage => ({
  inputTokens: a.inputTokens + b.inputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
  cachedInputTokens: a.cachedInputTokens + b.cachedInputTokens,
  cacheWriteTokens: (a.cacheWriteTokens ?? 0) + (b.cacheWriteTokens ?? 0),
})

export async function generateStructured<T>(req: StructuredRequest): Promise<StructuredResult<T>> {
  const route = req.route ?? resolveRoute(req.task, currentRouting())
  const adapter = ADAPTERS[route.provider]
  const info = modelInfo(route.model, route.provider)
  const client = req.clients?.[route.provider]
  // Text-only providers never see files (and resume PDFs never leave for them).
  const files = info.pdf ? (req.files ?? []) : []

  const start = Date.now()
  let total: TokenUsage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0 }
  let messages = req.messages

  for (let attempt = 1; attempt <= 2; attempt++) {
    const adapterReq: AdapterRequest = {
      model: route.model,
      system: req.system,
      messages,
      files,
      schema: req.schema,
      schemaName: req.schemaName,
      maxTokens: req.maxTokens,
      temperature: req.temperature,
      effort: req.effort,
    }
    const callStart = Date.now()
    let result: AdapterResult
    try {
      result = await adapter.call(adapterReq, client)
    } catch (error) {
      if (error && typeof error === 'object') {
        try {
          Object.assign(error, { provider: route.provider })
        } catch {
          // frozen error object: classification falls back to the default provider tag
        }
      }
      throw error
    }
    total = add(total, result.usage)

    const outcome: ParseOutcome<T> =
      result.stop === 'stop' && result.text.trim() ? parseAndValidate<T>(result.text, req.schema) : { ok: false, problem: result.stop }
    recordUsage(usageRecord(route.provider, result.model, result.usage, { task: req.task, ms: Date.now() - callStart, ok: outcome.ok }))

    if (result.stop === 'refusal') throw new AIOutputError('Model refused', 'refusal', route.provider, result.model)
    if (result.stop === 'length') throw new AIOutputError('Model output truncated', 'truncated', route.provider, result.model)
    if (!result.text.trim()) throw new AIOutputError('Empty model response', 'empty', route.provider, result.model)

    if (outcome.ok) {
      return {
        data: outcome.data,
        usage: total,
        model: result.model,
        provider: route.provider,
        ms: Date.now() - start,
        attempts: attempt,
        costUsd: costUsd(result.model, total),
      }
    }
    if (attempt === 2) throw new AIOutputError(`Invalid output after repair: ${outcome.problem}`, 'invalid', route.provider, result.model)
    messages = repairMessages(req.messages, result.text, outcome.problem)
  }
  throw new AIOutputError('unreachable', 'invalid', route.provider, route.model)
}

/**
 * Per-call overrides every AI lib accepts. `client` is the old hook (an OpenAI-shaped
 * client; tests use it) and pins the call to the OpenAI adapter. `model` alone picks that
 * model on its own provider. `route`/`clients` are the general form (the eval uses them).
 */
export interface AICallOptions {
  client?: unknown
  clients?: import('@/lib/ai/types').ProviderClients
  route?: import('@/lib/ai/routing').ModelRoute
  model?: string
}

export function callOverrides(
  task: import('@/lib/ai/routing').AITask,
  o: AICallOptions = {}
): Pick<StructuredRequest, 'route' | 'clients'> {
  if (o.route) return { route: o.route, clients: o.clients }
  if (o.client) {
    const configured = taskRoute(task)
    const model = o.model ?? (configured.provider === 'openai' ? configured.model : 'gpt-4o')
    return { route: { provider: 'openai', model }, clients: { ...o.clients, openai: o.client } }
  }
  if (o.model) return { route: { provider: modelInfo(o.model).provider, model: o.model }, clients: o.clients }
  return { clients: o.clients }
}
