// Turn OpenAI SDK errors into something honest for users and loud for us.
//
// A 429 is two different things: `insufficient_quota` means the account is out of credit
// (nothing the user can do, retrying won't help, we need to top up), while a plain rate
// limit clears in seconds. Only the second gets a "try again" message.
//
// openai-node v4 puts the response body's `error` object on `err.error` and copies its
// `code`/`type` onto the error itself, but the code can be null with only `type` set, and
// wrappers (ours, Next, fetch) sometimes nest the original under `cause`. So every place
// a code can live is checked, not just the first non-null one.

export type AIErrorKind = 'quota' | 'rate_limit' | 'auth' | 'too_long' | 'not_configured' | 'unavailable'

export interface ClassifiedAIError {
  kind: AIErrorKind
  status: number // HTTP status for our own response
  userMessage: string
  retryable: boolean
}

// Codes/types OpenAI uses when the account (not the request) can't be billed.
const QUOTA_CODES = new Set(['insufficient_quota', 'billing_hard_limit_reached', 'billing_not_active', 'access_terminated'])
const QUOTA_MESSAGE = /insufficient_quota|exceeded your current quota|billing hard limit|billing_not_active|check your plan and billing/i

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
  return errorCodes(error).some((c) => QUOTA_CODES.has(c)) || QUOTA_MESSAGE.test(messages(error))
}

const unavailable = (feature: string) => `${feature} is temporarily unavailable, we're on it.`

/**
 * `feature` is the user-facing noun: "Tailoring", "Resume reading", "Job lookup".
 * Logs quota exhaustion and auth failures at error level with a greppable tag.
 */
export function classifyAIError(error: unknown, feature = 'Tailoring'): ClassifiedAIError {
  const status = statusOf(error)
  const message = messages(error)
  const codes = errorCodes(error)

  if (/OPENAI_API_KEY/.test(message) && /not configured|required/i.test(message)) {
    console.error('[OPENAI_NOT_CONFIGURED]', message)
    return { kind: 'not_configured', status: 503, userMessage: unavailable(feature), retryable: false }
  }
  if (isInsufficientQuota(error)) {
    console.error(
      '[OPENAI_QUOTA_EXHAUSTED] OpenAI says the account is out of credit; every AI call will fail until billing is topped up.',
      { feature, status, codes, message }
    )
    return { kind: 'quota', status: 503, userMessage: unavailable(feature), retryable: false }
  }
  if (status === 401 || status === 403) {
    console.error('[OPENAI_AUTH_FAILED] OpenAI rejected the API key (bad, revoked, or no access to this model/project).', {
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
    console.warn('[OPENAI_RATE_LIMITED]', { feature, codes, message })
    return { kind: 'rate_limit', status: 429, userMessage: 'The AI service is busy right now. Please try again in a minute.', retryable: true }
  }
  if (/context_length|maximum context|maximum.*tokens/i.test(message) || codes.includes('context_length_exceeded')) {
    return { kind: 'too_long', status: 400, userMessage: 'That is too long for us to process. Please shorten it and try again.', retryable: false }
  }
  console.error('[OPENAI_ERROR]', { feature, status, codes, message })
  return { kind: 'unavailable', status: 502, userMessage: `${feature} failed. Please try again.`, retryable: true }
}
