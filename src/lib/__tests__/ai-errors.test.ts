import { afterEach, describe, expect, it, vi } from 'vitest'
import { APIError } from 'openai'
import { classifyAIError, errorCodes, isInsufficientQuota } from '@/lib/ai-errors'

// Errors built the way openai-node v4 builds them from a real HTTP response:
// APIError.generate(status, parsedBody, message, headers).
function sdkError(status: number, body: unknown) {
  return APIError.generate(status, body as never, undefined, { 'x-request-id': 'req_test' } as never)
}

const QUOTA_BODY = {
  error: {
    message:
      'You exceeded your current quota, please check your plan and billing details. For more information on this error, read the docs: https://platform.openai.com/docs/guides/error-codes/api-errors.',
    type: 'insufficient_quota',
    param: null,
    code: 'insufficient_quota',
  },
}

describe('classifyAIError', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  afterEach(() => {
    errorSpy.mockClear()
    warnSpy.mockClear()
  })

  it('treats a real SDK insufficient_quota 429 as an outage, not a busy signal, and logs it loudly', () => {
    const error = sdkError(429, QUOTA_BODY)
    expect(error.status).toBe(429)
    expect(isInsufficientQuota(error)).toBe(true)
    const result = classifyAIError(error, 'Tailoring')
    expect(result).toMatchObject({ kind: 'quota', status: 503, retryable: false })
    expect(result.userMessage).toBe("Tailoring is temporarily unavailable, we're on it.")
    expect(result.userMessage).not.toMatch(/busy/i)
    expect(String(errorSpy.mock.calls[0][0])).toContain('OPENAI_QUOTA_EXHAUSTED')
  })

  it('finds the quota code on err.code, err.error.code and err.error.type independently', () => {
    const onlyTopCode = { status: 429, code: 'insufficient_quota', message: '429' }
    const onlyNestedCode = { status: 429, code: null, error: { code: 'insufficient_quota' }, message: '429' }
    const onlyNestedType = { status: 429, code: null, type: null, error: { code: null, type: 'insufficient_quota' }, message: '429' }
    // A different code on top must not hide the nested one (a `??` chain would stop at it).
    const shadowed = { status: 429, code: 'rate_limit_exceeded', error: { type: 'insufficient_quota' }, message: '429' }
    const wrapped = new Error('Tailor failed', { cause: sdkError(429, { error: { type: 'insufficient_quota', code: null, message: 'x' } }) })
    for (const e of [onlyTopCode, onlyNestedCode, onlyNestedType, shadowed, wrapped]) {
      expect(classifyAIError(e).kind).toBe('quota')
    }
  })

  it('treats an SDK body with only type=insufficient_quota and code=null as quota', () => {
    const error = sdkError(429, { error: { message: 'Quota', type: 'insufficient_quota', param: null, code: null } })
    expect(errorCodes(error)).toContain('insufficient_quota')
    expect(classifyAIError(error).kind).toBe('quota')
  })

  it('keeps a retry message for real rate limits', () => {
    const error = sdkError(429, {
      error: { message: 'Rate limit reached for gpt-4o in organization org-x on tokens per min (TPM).', type: 'tokens', param: null, code: 'rate_limit_exceeded' },
    })
    const result = classifyAIError(error)
    expect(result).toMatchObject({ kind: 'rate_limit', status: 429, retryable: true })
    expect(result.userMessage).toMatch(/try again/i)
    expect(String(warnSpy.mock.calls[0][0])).toContain('OPENAI_RATE_LIMITED')
  })

  it('hides a bad key (401) from users and logs it', () => {
    const error = sdkError(401, {
      error: { message: 'Incorrect API key provided: sk-abc***.', type: 'invalid_request_error', param: null, code: 'invalid_api_key' },
    })
    const result = classifyAIError(error, 'Tailoring')
    expect(result).toMatchObject({ kind: 'auth', status: 503, retryable: false })
    expect(result.userMessage).toBe("Tailoring is temporarily unavailable, we're on it.")
    expect(String(errorSpy.mock.calls[0][0])).toContain('OPENAI_AUTH_FAILED')
  })

  it('treats 403 (no access to model/project) the same as a bad key', () => {
    const error = sdkError(403, { error: { message: 'Project does not have access to model gpt-4o', type: 'invalid_request_error', param: null, code: 'model_not_found' } })
    expect(classifyAIError(error)).toMatchObject({ kind: 'auth', status: 503 })
  })

  it('flags a missing key as not configured', () => {
    expect(classifyAIError(new Error('OPENAI_API_KEY environment variable is required')).kind).toBe('not_configured')
  })

  it('falls back to a retryable failure for 5xx', () => {
    expect(classifyAIError(sdkError(500, { error: { message: 'boom', type: 'server_error', code: null } }))).toMatchObject({
      kind: 'unavailable',
      retryable: true,
    })
  })
})
