// Which provider and model runs each AI task. Server only (reads env).
//
// Env, format `provider:model`:
//   AI_PARSE, AI_JOB_EXTRACT, AI_TAILOR, AI_COVER_LETTER, AI_EVIDENCE
//   AI_FREE_TIER   FREE users' tailor/cover letter/evidence, and paid users past 75% of
//                  their AI cap (src/lib/ai-cap-rules.ts). Recommended anthropic:claude-sonnet-5-5.
//
// Defaults: everything on Claude Opus 5.5 when ANTHROPIC_API_KEY is set, otherwise the
// OpenAI models the app used before (and their old OPENAI_*_MODEL overrides).
//
// Privacy: resume text is personal data. It only ever goes to a provider named here by
// env, and every default is a paid first-party API (Anthropic or OpenAI). There is no
// fallback to a free or community endpoint; OpenRouter is used only when an AI_* var
// names it explicitly.
import type { ProviderId } from '@/lib/ai/models'
import { POWERED_BY } from '@/lib/plans'

export type AITask = 'parse' | 'jobExtract' | 'tailor' | 'coverLetter' | 'evidence'

export const TASK_ENV: Record<AITask, string> = {
  parse: 'AI_PARSE',
  jobExtract: 'AI_JOB_EXTRACT',
  tailor: 'AI_TAILOR',
  coverLetter: 'AI_COVER_LETTER',
  evidence: 'AI_EVIDENCE',
}

export const TASKS = Object.keys(TASK_ENV) as AITask[]

// Tasks that follow the user's plan (AI_FREE_TIER for FREE, and the 75% downgrade).
// Parse and job extraction always use the task routing: everyone gets the same reader.
export const PLAN_TASKS: ReadonlySet<AITask> = new Set(['tailor', 'coverLetter', 'evidence'])

export interface ModelRoute {
  provider: ProviderId
  model: string
}

export const PROVIDERS: ProviderId[] = ['anthropic', 'openai', 'openrouter']

export const PROVIDER_KEY_ENV: Record<ProviderId, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
}

const env = (name: string) => process.env[name]?.trim() || ''

export function providerConfigured(provider: ProviderId): boolean {
  return !!env(PROVIDER_KEY_ENV[provider])
}

export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5'

// What the app ran on before this layer existed. Old env overrides still apply.
function legacyOpenAIModel(task: AITask): string {
  switch (task) {
    case 'parse':
      return env('OPENAI_PARSE_MODEL') || 'gpt-4o'
    case 'jobExtract':
      return env('OPENAI_JOB_MODEL') || 'gpt-4o-mini'
    case 'tailor':
      return env('OPENAI_TAILOR_MODEL') || 'gpt-4o'
    case 'coverLetter':
      return env('OPENAI_COVER_LETTER_MODEL') || env('OPENAI_TAILOR_MODEL') || 'gpt-4o'
    case 'evidence':
      return env('OPENAI_EVIDENCE_MODEL') || env('OPENAI_TAILOR_MODEL') || 'gpt-4o'
  }
}

/** Parses `provider:model`. OpenRouter ids contain a slash, never a colon prefix clash. */
export function parseRoute(value: string | undefined | null): ModelRoute | null {
  const raw = value?.trim()
  if (!raw) return null
  const i = raw.indexOf(':')
  if (i <= 0) return null
  const provider = raw.slice(0, i).trim().toLowerCase()
  const model = raw.slice(i + 1).trim()
  if (!model || !(PROVIDERS as string[]).includes(provider)) return null
  return { provider: provider as ProviderId, model }
}

export const formatRoute = (r: ModelRoute) => `${r.provider}:${r.model}`

const warned = new Set<string>()
function routeFromEnv(name: string): ModelRoute | null {
  const raw = env(name)
  const route = parseRoute(raw)
  if (raw && !route && !warned.has(name)) {
    warned.add(name)
    console.error(`[AI_ROUTING] ${name}="${raw}" is not provider:model (provider is anthropic, openai or openrouter). Using the default.`)
  }
  return route
}

/** The configured route for a task, ignoring the user's plan. */
export function taskRoute(task: AITask): ModelRoute {
  const configured = routeFromEnv(TASK_ENV[task])
  if (configured) return configured
  if (providerConfigured('anthropic')) return { provider: 'anthropic', model: DEFAULT_ANTHROPIC_MODEL }
  return { provider: 'openai', model: legacyOpenAIModel(task) }
}

/** AI_FREE_TIER, or null when unset (FREE users then get the task routing). */
export function freeTierRoute(): ModelRoute | null {
  return routeFromEnv('AI_FREE_TIER')
}

export type PlanTier = 'free' | 'pro'

export interface RoutingContext {
  tier: PlanTier
  // Paid user past 75% of their AI cap: run plan tasks on AI_FREE_TIER.
  downgraded?: boolean
}

/** The route for one call: task routing, then the plan override for plan tasks. */
export function resolveRoute(task: AITask, ctx?: RoutingContext | null): ModelRoute {
  const base = taskRoute(task)
  if (!ctx || !PLAN_TASKS.has(task)) return base
  const free = freeTierRoute()
  if (!free) return base
  if (ctx.tier === 'free' || ctx.downgraded) return free
  return base
}

/** Can the 75% band actually change anything? (A free-tier route that differs from Pro's tailor route.) */
export function downgradeAvailable(): boolean {
  const free = freeTierRoute()
  if (!free) return false
  const pro = taskRoute('tailor')
  return free.provider !== pro.provider || free.model !== pro.model
}

export function proAlwaysTopModel(): boolean {
  return /^(1|true|yes)$/i.test(env('AI_PRO_ALWAYS_OPUS'))
}

/** Every route the app might use right now (for /api/health). */
export function allRoutes(): Record<AITask | 'freeTier', ModelRoute | null> {
  return {
    parse: taskRoute('parse'),
    jobExtract: taskRoute('jobExtract'),
    tailor: taskRoute('tailor'),
    coverLetter: taskRoute('coverLetter'),
    evidence: taskRoute('evidence'),
    freeTier: freeTierRoute(),
  }
}

/**
 * The "Powered by Claude Opus 5.5" pricing line: only when the flag in plans.ts is on AND
 * Pro tailoring really runs on that model.
 */
export function showPoweredBy(): boolean {
  if (!POWERED_BY.enabled) return false
  const r = taskRoute('tailor')
  return r.provider === 'anthropic' && r.model === POWERED_BY.model
}
