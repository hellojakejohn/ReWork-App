// Turn provider SDK errors (OpenAI, Anthropic, OpenRouter) into something honest for
// users and loud for us. One classification for every provider: it feeds the user
// messages in each feature and the checks on /api/health.
//
// Anthropic: 401 authentication_error, 403 permission_error, 402 billing_error, 429
// rate_limit_error, 529 overloaded_error, and a 400 "credit balance is too low" when the
// account is out of credit. OpenRouter: 402 when the account has no credits left, and
// OpenAI-shaped bodies otherwise.
//
// A 429 is two different things: `insufficient_quota` means the account is out of credit
// (nothing the user can do, retrying won't help, we need to top up), while a plain rate
// limit clears in seconds. Only the second gets a "try again" message.
//
// openai-node v4 puts the response body's `error` object on `err.error` and copies its
// `code`/`type` onto the error itself, but the code can be null with only `type` set, and
// wrappers (ours, Next, fetch) sometimes nest the original under `cause`. So every place
// a code can live is checked, not just the first non-null one.

export type AIErrorKind =
  | 'quota'
  | 'rate_limit'
  | 'overloaded'
  | 'auth'
  | 'too_long'
  | 'not_configured'
  | 'invalid_output' // the call worked but the answer wasn't usable (bad JSON, schema, refusal, truncated)
  | 'unavailable'

export interface ClassifiedAIError {
  kind: AIErrorKind
  status: number // HTTP status for our own response
  userMessage: string
  retryable: boolean
}

// Codes/types OpenAI uses when the account (not the request) can't be billed.
const QUOTA_CODES = new Set(['insufficient_quota', 'billing_hard_limit_reached', 'billing_not_active', 'access_terminated', 'billing_error'])
const QUOTA_MESSAGE =
  /insufficient_quota|exceeded your current quota|billing hard limit|billing_not_active|check your plan and billing|credit balance is too low|insufficient credits|requires more credits/i
const OVERLOADED_CODES = new Set(['overloaded_error', 'overloaded'])

/* eslint-disable @typescript-eslint/no-explicit-any */

/** The error, its `error` body, a nested `error.error`, and `cause`, up to a few levels. */
function layers(error: any): any[] {
  const out: any[] = []
  const queue = [error]
  while (queue.length && out.length < 8) {
    const e = queue.shift()
    if (!e || typeof e !== 'object' || out.includes(e)) continue
    out.push(e)
    queue.push(e.error, e.cause, e.body)
  }
  return out
}

/** Every code/type string found anywhere on the error. */
export function errorCodes(error: unknown): string[] {
  const codes: string[] = []
  for (const layer of layers(error)) {
    for (const value of [layer.code, layer.type]) {
      if (typeof value === 'string' && value) codes.push(value)
    }
  }
  return codes
}

function messages(error: unknown): string {
  return layers(error)
    .map((l) => (typeof l.message === 'string' ? l.message : ''))
    .join(' | ')
}

function statusOf(error: unknown): number {
  for (const layer of layers(error)) {
    const status = Number(layer.status ?? layer.statusCode ?? 0)
    if (status) return status
  }
  return 0
}

export function isInsufficientQuota(error: unknown): boolean {
  return statusOf(error) === 402 || errorCodes(error).some((c) => QUOTA_CODES.has(c)) || QUOTA_MESSAGE.test(messages(error))
}

/** The provider an adapter tagged the error with (src/lib/ai/), else OpenAI (the old default). */
function providerOf(error: unknown): string {
  for (const layer of layers(error)) {
    if (typeof layer.provider === 'string' && layer.provider) return layer.provider
  }
  return 'openai'
}

/** Thrown by the AI layer when the provider answered but the answer can't be used. */
export class AIOutputError extends Error {
  readonly kind = 'invalid_output'
  constructor(
    message: string,
    // refusal: the model declined; truncated: hit max tokens; invalid: bad JSON or schema
    public readonly reason: 'refusal' | 'truncated' | 'invalid' | 'empty',
    public readonly provider: string,
    public readonly model: string
  ) {
    super(message)
    this.name = 'AIOutputError'
  }
}

const unavailable = (feature: string) => `${feature} is temporarily unavailable, we're on it.`

/**
 * `feature` is the user-facing noun: "Tailoring", "Resume reading", "Job lookup".
 * Logs quota exhaustion and auth failures at error level with a greppable tag.
 */
const BUSY = 'The AI service is busy right now. Please try again in a minute.'

export function classifyAIError(error: unknown, feature = 'Tailoring'): ClassifiedAIError {
  const status = statusOf(error)
  const message = messages(error)
  const codes = errorCodes(error)
  const provider = providerOf(error)
  const tag = (what: string) => `[${provider.toUpperCase()}_${what}]`

  if (error instanceof AIOutputError) {
    console.error(tag('INVALID_OUTPUT'), { feature, reason: error.reason, model: error.model, message })
    return { kind: 'invalid_output', status: 502, userMessage: `${feature} failed. Please try again.`, retryable: true }
  }
  if (/_API_KEY/.test(message) && /not configured|required|not set/i.test(message)) {
    console.error(`[${/ANTHROPIC/.test(message) ? 'ANTHROPIC' : /OPENROUTER/.test(message) ? 'OPENROUTER' : 'OPENAI'}_NOT_CONFIGURED]`, message)
    return { kind: 'not_configured', status: 503, userMessage: unavailable(feature), retryable: false }
  }
  if (isInsufficientQuota(error)) {
    console.error(
      `${tag('QUOTA_EXHAUSTED')} ${provider} says the account is out of credit; every AI call on it will fail until billing is topped up.`,
      { feature, status, codes, message }
    )
    return { kind: 'quota', status: 503, userMessage: unavailable(feature), retryable: false }
  }
  if (status === 401 || status === 403) {
    console.error(`${tag('AUTH_FAILED')} ${provider} rejected the API key (bad, revoked, or no access to this model/project).`, {
      feature,
      status,
      codes,
      message,
    })
    return { kind: 'auth', status: 503, userMessage: unavailable(feature), retryable: false }
  }
  if (status === 429) {
    // Logged with its codes so if this ever turns out to be a quota error in a shape we
    // don't know yet, the log says so.
    console.warn(tag('RATE_LIMITED'), { feature, codes, message })
    return { kind: 'rate_limit', status: 429, userMessage: BUSY, retryable: true }
  }
  if (status === 529 || codes.some((c) => OVERLOADED_CODES.has(c)) || /overloaded/i.test(message)) {
    console.warn(tag('OVERLOADED'), { feature, status, codes, message })
    return { kind: 'overloaded', status: 503, userMessage: BUSY, retryable: true }
  }
  if (/context_length|maximum context|maximum.*tokens|prompt is too long/i.test(message) || codes.includes('context_length_exceeded') || status === 413) {
    return { kind: 'too_long', status: 400, userMessage: 'That is too long for us to process. Please shorten it and try again.', retryable: false }
  }
  console.error(tag('ERROR'), { feature, status, codes, message })
  return { kind: 'unavailable', status: 502, userMessage: `${feature} failed. Please try again.`, retryable: true }
}
