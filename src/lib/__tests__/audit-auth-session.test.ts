// Audit (launch-audit): NextAuth config, origin detection on Vercel, redirects, crons, admin.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: vi.fn(async () => [{ '?column?': 1 }]) } }))
vi.mock('@/lib/entitlements', () => ({ getAccess: vi.fn(), expireEntitlements: vi.fn(async () => ({ expired: 0 })) }))
vi.mock('@/lib/track', () => ({ track: vi.fn() }))

import { authOptions } from '@/lib/auth'
import { safeRedirect } from '@/lib/auth-redirect'
import { isAdminEmail } from '@/lib/admin'
// Not in next-auth's exports map; load the installed file directly (4.24.x).
import { createRequire } from 'node:module'
const { detectOrigin } = createRequire(import.meta.url)('../../../node_modules/next-auth/utils/detect-origin.js') as { detectOrigin: (host: string, proto: string) => string }

afterEach(() => vi.unstubAllEnvs())

describe('NextAuth options', () => {
  it('database sessions, NextAuth default lifetime (30 days, refreshed daily), no cookie overrides', () => {
    expect(authOptions.session?.strategy).toBe('database')
    expect(authOptions.session?.maxAge).toBeUndefined()
    expect(authOptions.cookies).toBeUndefined()
    expect(authOptions.useSecureCookies).toBeUndefined() // derived from an https NEXTAUTH_URL
  })

  it('Google only, and no dangerous email account linking', () => {
    expect(authOptions.providers.map((p) => p.id)).toEqual(['google'])
    const opts = (authOptions.providers[0] as any).options ?? {}
    expect(opts.allowDangerousEmailAccountLinking).not.toBe(true)
  })

  // Admin is an email allowlist, so the email on the account must be one Google verified.
  // No signIn callback checks profile.email_verified today.
  it('a Google profile with email_verified: false is refused at sign-in', async () => {
    const signIn = authOptions.callbacks?.signIn
    expect(signIn).toBeTypeOf('function')
    const result = await signIn!({
      user: { id: 'u', email: 'hellojakejohn@gmail.com' } as any,
      account: { provider: 'google', type: 'oauth', providerAccountId: '1' } as any,
      profile: { email: 'hellojakejohn@gmail.com', email_verified: false } as any,
    } as any)
    expect(result).toBe(false)
  })
})

describe('origin on Vercel (what a preview deployment does)', () => {
  it('NEXTAUTH_URL wins over the preview host, so OAuth redirect_uri points at prod', () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://rework.hellojakejohn.com')
    vi.stubEnv('VERCEL', '1')
    expect(detectOrigin('rework-git-branch-jake.vercel.app', 'https')).toBe('https://rework.hellojakejohn.com')
  })

  it('without NEXTAUTH_URL on Vercel, the forwarded (preview) host is used', () => {
    vi.stubEnv('NEXTAUTH_URL', '')
    vi.stubEnv('VERCEL', '1')
    expect(detectOrigin('rework-git-branch-jake.vercel.app', 'https')).toBe('https://rework-git-branch-jake.vercel.app')
  })
})

describe('safeRedirect, more hostile inputs (regression guard)', () => {
  const base = 'https://rework.example.com'
  const fallback = `${base}/dashboard`
  it.each([
    ['https:evil.com'],
    ['HTTPS://EVIL.COM/dashboard'],
    ['//evil.com'],
    ['/\\evil.com'],
    ['\\\\evil.com'],
    ['javascript:alert(1)'],
    ['data:text/html,hi'],
    ['https://rework.example.com.evil.com/'],
    ['https://rework.example.com@evil.com/'],
    ['http://rework.example.com/dashboard'], // scheme downgrade
    ['https://rework.example.com:8443/dashboard'],
    ['/api/auth/signout'],
    ['/auth/signin?callbackUrl=https://evil.com'],
  ])('%s -> fallback', (url) => {
    expect(safeRedirect(url, base)).toBe(fallback)
  })

  it.each([
    ['/\t/evil.com'],
    ['/%2F%2Fevil.com'],
    ['/dashboard/tracker'],
  ])('%s stays on our origin', (url) => {
    expect(new URL(safeRedirect(url, base)).origin).toBe(base)
  })
})

describe('cron routes (regression guard)', () => {
  const routes = ['@/app/api/keepalive/route', '@/app/api/cron/expire-entitlements/route']
  const call = async (mod: string, auth?: string) => {
    const { GET } = await import(/* @vite-ignore */ mod)
    return (await GET(new Request('http://localhost/x', auth ? { headers: { authorization: auth } } : {}))) as Response
  }

  it.each(routes)('%s fails closed when CRON_SECRET is unset or blank', async (mod) => {
    vi.stubEnv('CRON_SECRET', '   ')
    expect((await call(mod, 'Bearer ')).status).toBe(401)
    expect((await call(mod, 'Bearer    ')).status).toBe(401)
  })

  it.each(routes)('%s needs the exact bearer secret', async (mod) => {
    vi.stubEnv('CRON_SECRET', 'cron-test-value')
    expect((await call(mod)).status).toBe(401)
    expect((await call(mod, 'Bearer cron-test-valuX')).status).toBe(401)
    expect((await call(mod, 'bearer cron-test-value')).status).toBe(401)
    expect((await call(mod, 'Bearer cron-test-value')).status).toBe(200)
  })
})

describe('admin allowlist (regression guard)', () => {
  it('is case-insensitive and trims the env list', () => {
    vi.stubEnv('ADMIN_EMAILS', ' Boss@Example.com , other@example.com ')
    expect(isAdminEmail('boss@example.com')).toBe(true)
    expect(isAdminEmail('BOSS@EXAMPLE.COM')).toBe(true)
    expect(isAdminEmail('boss@example.com.evil.com')).toBe(false)
    expect(isAdminEmail('')).toBe(false)
    expect(isAdminEmail(null)).toBe(false)
  })
})
