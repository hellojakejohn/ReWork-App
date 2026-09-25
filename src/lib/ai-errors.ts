// Turn OpenAI SDK errors into something honest for users and loud for us.
//
// A 429 is two different things: `insufficient_quota` means the account is out of credit
// (nothing the user can do, retrying won't help, we need to top up), while a plain rate
// limit clears in seconds. Only the second gets a "try again" message.

export type AIErrorKind = 'quota' | 'rate_limit' | 'auth' | 'too_long' | 'not_configured' | 'unavailable'

export interface ClassifiedAIError {
  kind: AIErrorKind
  status: number // HTTP status for our own response
  userMessage: string
  retryable: boolean
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function errorCode(error: any): string {
  return String(error?.code ?? error?.error?.code ?? error?.error?.type ?? error?.type ?? '')
}

export function isInsufficientQuota(error: unknown): boolean {
  const e = error as any
  const code = errorCode(e)
  const message = String(e?.message ?? '')
  return code === 'insufficient_quota' || /insufficient_quota|exceeded your current quota/i.test(message)
}

/**
 * `feature` is the user-facing noun: "Tailoring", "Resume reading", "Job lookup".
 * Logs quota exhaustion at error level with a greppable tag.
 */
export function classifyAIError(error: unknown, feature = 'Tailoring'): ClassifiedAIError {
  const e = error as any
  const status = Number(e?.status ?? 0)
  const message = String(e?.message ?? '')

  if (/OPENAI_API_KEY/.test(message) && /not configured|required/i.test(message)) {
    console.error('[OPENAI_NOT_CONFIGURED]', message)
    return { kind: 'not_configured', status: 503, userMessage: `${feature} is temporarily unavailable, we're on it.`, retryable: false }
  }
  if (isInsufficientQuota(e)) {
    console.error(
      '[OPENAI_QUOTA_EXHAUSTED] OpenAI returned insufficient_quota. The account is out of credit; every AI call will fail until billing is topped up.',
      { feature, status, message }
    )
    return { kind: 'quota', status: 503, userMessage: `${feature} is temporarily unavailable, we're on it.`, retryable: false }
  }
  if (status === 429) {
    return { kind: 'rate_limit', status: 429, userMessage: 'The AI service is busy right now. Please try again in a minute.', retryable: true }
  }
  if (status === 401 || status === 403) {
    console.error('[OPENAI_AUTH_FAILED]', { feature, status, message })
    return { kind: 'auth', status: 503, userMessage: `${feature} is temporarily unavailable, we're on it.`, retryable: false }
  }
  if (/context_length|maximum context|maximum.*tokens/i.test(message)) {
    return { kind: 'too_long', status: 400, userMessage: 'That is too long for us to process. Please shorten it and try again.', retryable: false }
  }
  console.error('[OPENAI_ERROR]', { feature, status, message })
  return { kind: 'unavailable', status: 502, userMessage: `${feature} failed. Please try again.`, retryable: true }
}
