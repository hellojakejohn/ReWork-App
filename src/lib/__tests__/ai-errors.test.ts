import { afterEach, describe, expect, it, vi } from 'vitest'
import { classifyAIError, isInsufficientQuota } from '@/lib/ai-errors'

describe('classifyAIError', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  afterEach(() => spy.mockClear())

  it('treats insufficient_quota as an outage, not a busy signal, and logs it loudly', () => {
    const error = Object.assign(new Error('429 You exceeded your current quota, please check your plan and billing details.'), {
      status: 429,
      code: 'insufficient_quota',
    })
    expect(isInsufficientQuota(error)).toBe(true)
    const result = classifyAIError(error, 'Tailoring')
    expect(result).toMatchObject({ kind: 'quota', status: 503, retryable: false })
    expect(result.userMessage).toBe("Tailoring is temporarily unavailable, we're on it.")
    expect(result.userMessage).not.toMatch(/busy/i)
    expect(String(spy.mock.calls[0][0])).toContain('OPENAI_QUOTA_EXHAUSTED')
  })

  it('detects quota from the nested error body too', () => {
    expect(isInsufficientQuota({ status: 429, error: { code: 'insufficient_quota' } })).toBe(true)
  })

  it('keeps a retry message for real rate limits', () => {
    const result = classifyAIError(Object.assign(new Error('Rate limit reached for gpt-4o'), { status: 429, code: 'rate_limit_exceeded' }))
    expect(result).toMatchObject({ kind: 'rate_limit', status: 429, retryable: true })
    expect(result.userMessage).toMatch(/try again/i)
  })

  it('hides auth failures from users', () => {
    expect(classifyAIError({ status: 401, message: 'Incorrect API key' })).toMatchObject({ kind: 'auth', status: 503 })
  })
})
