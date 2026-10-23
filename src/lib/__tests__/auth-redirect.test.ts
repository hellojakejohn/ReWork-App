import { describe, expect, it } from 'vitest'
import { safeRedirect } from '@/lib/auth-redirect'

const base = 'https://rework.test'

describe('safeRedirect', () => {
  it('keeps same-origin deep links, absolute or relative', () => {
    expect(safeRedirect('https://rework.test/dashboard/tracker', base)).toBe('https://rework.test/dashboard/tracker')
    expect(safeRedirect('/dashboard?application=abc', base)).toBe('https://rework.test/dashboard?application=abc')
    expect(safeRedirect('/pricing', base)).toBe('https://rework.test/pricing')
    expect(safeRedirect('/?deleted=1', base)).toBe('https://rework.test/?deleted=1')
  })

  it('never leaves the site', () => {
    for (const url of ['https://evil.test/x', '//evil.test/x', '/\\evil.test', 'https://rework.test.evil.test/', 'javascript:alert(1)', 'not a url']) {
      expect(safeRedirect(url, base)).toBe('https://rework.test/dashboard')
    }
  })

  it('sends the sign-in page and NextAuth routes to the dashboard instead of looping', () => {
    expect(safeRedirect('/auth/signin', base)).toBe('https://rework.test/dashboard')
    expect(safeRedirect('https://rework.test/api/auth/signin', base)).toBe('https://rework.test/dashboard')
  })
})
