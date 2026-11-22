import { afterEach, describe, expect, it, vi } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import { classifyAIError, errorCodes, isInsufficientQuota } from '@/lib/ai-errors'

// Errors built the way the Anthropic SDK builds them from a real HTTP response:
// APIError.generate(status, parsedBody, message, headers).
function sdkError(status: number, type: string, message: string) {
  return Anthropic.APIError.generate(status, { type: 'error', error: { type, message } } as never, undefined, new Headers({ 'request-id': 'req_test' }) as never)
}

describe('classifyAIError', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  afterEach(() => {
    errorSpy.mockClear()
    warnSpy.mockClear()
  })

  it('treats an out-of-credit account as an outage, not a busy signal, and logs it loudly', () => {
    const error = sdkError(400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.')
    expect(isInsufficientQuota(error)).toBe(true)
    const result = classifyAIError(error, 'Tailoring')
    expect(result).toMatchObject({ kind: 'quota', status: 503, retryable: false })
    expect(result.userMessage).toBe("Tailoring is temporarily unavailable, we're on it.")
    expect(result.userMessage).not.toMatch(/busy/i)
    expect(String(errorSpy.mock.calls[0][0])).toContain('ANTHROPIC_QUOTA_EXHAUSTED')
  })

  it('treats a billing_error (402) as quota', () => {
    const error = sdkError(402, 'billing_error', 'billing problem')
    expect(errorCodes(error)).toContain('billing_error')
    expect(classifyAIError(error).kind).toBe('quota')
  })

  it('finds a quota code on err.code, err.error.code and err.error.type independently', () => {
    const onlyTopCode = { status: 429, code: 'insufficient_quota', message: '429' }
    const onlyNestedCode = { status: 429, code: null, error: { code: 'insufficient_quota' }, message: '429' }
    const onlyNestedType = { status: 429, code: null, type: null, error: { code: null, type: 'insufficient_quota' }, message: '429' }
    // A different code on top must not hide the nested one (a `??` chain would stop at it).
    const shadowed = { status: 429, code: 'rate_limit_exceeded', error: { type: 'insufficient_quota' }, message: '429' }
    const wrapped = new Error('Tailor failed', { cause: sdkError(402, 'billing_error', 'x') })
    for (const e of [onlyTopCode, onlyNestedCode, onlyNestedType, shadowed, wrapped]) {
      expect(classifyAIError(e).kind).toBe('quota')
    }
  })

  it('keeps a retry message for real rate limits', () => {
    const result = classifyAIError(sdkError(429, 'rate_limit_error', 'Number of request tokens has exceeded your per-minute rate limit'))
    expect(result).toMatchObject({ kind: 'rate_limit', status: 429, retryable: true })
    expect(result.userMessage).toMatch(/try again/i)
    expect(String(warnSpy.mock.calls[0][0])).toContain('ANTHROPIC_RATE_LIMITED')
  })

  it('says busy when Anthropic is overloaded (529)', () => {
    expect(classifyAIError(sdkError(529, 'overloaded_error', 'Overloaded'))).toMatchObject({ kind: 'overloaded', retryable: true })
  })

  it('hides a bad key (401) from users and logs it', () => {
    const result = classifyAIError(sdkError(401, 'authentication_error', 'invalid x-api-key'), 'Tailoring')
    expect(result).toMatchObject({ kind: 'auth', status: 503, retryable: false })
    expect(result.userMessage).toBe("Tailoring is temporarily unavailable, we're on it.")
    expect(String(errorSpy.mock.calls[0][0])).toContain('ANTHROPIC_AUTH_FAILED')
  })

  it('treats 403 (no access to the model) the same as a bad key', () => {
    expect(classifyAIError(sdkError(403, 'permission_error', 'no access'))).toMatchObject({ kind: 'auth', status: 503 })
  })

  it('flags a missing key as not configured', () => {
    expect(classifyAIError(new Error('ANTHROPIC_API_KEY is not configured')).kind).toBe('not_configured')
    expect(String(errorSpy.mock.calls[0][0])).toContain('ANTHROPIC_NOT_CONFIGURED')
  })

  it('falls back to a retryable failure for 5xx', () => {
    expect(classifyAIError(sdkError(500, 'api_error', 'boom'))).toMatchObject({ kind: 'unavailable', retryable: true })
  })
})
