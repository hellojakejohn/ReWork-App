// Checkout with an active Job Hunt Pass: the monthly subscription's billing starts when
// the pass ends (subscription_data.trial_end), so nobody pays twice.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { DAY_MS, MIN_TRIAL_MS, subscriptionTrialEnd } from '@/lib/entitlement-rules'

const mocks = vi.hoisted(() => ({
  session: { user: { id: 'user_1', email: 'j@x.io' } } as unknown,
  passEnd: null as Date | null,
  sessionsCreate: vi.fn(async (params: Record<string, unknown>) => ({ url: 'https://checkout.stripe.test/s', params })),
}))

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => mocks.session) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(async () => ({ id: 'user_1', email: 'j@x.io', stripeCustomerId: 'cus_1' })), update: vi.fn() },
    entitlement: { findFirst: vi.fn(async () => null) },
  },
}))
vi.mock('@/lib/entitlements', () => ({ currentChainEnd: vi.fn(async () => mocks.passEnd) }))
vi.mock('@/lib/stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stripe')>()
  return {
    ...actual,
    getStripe: () => ({
      subscriptions: { list: vi.fn(async () => ({ data: [] })) },
      customers: { create: vi.fn() },
      checkout: { sessions: { create: mocks.sessionsCreate } },
    }),
  }
})

import { POST } from '../route'

function checkout(offer: 'monthly' | 'pass') {
  return POST(
    new NextRequest('https://rework.test/api/stripe/checkout', {
      method: 'POST',
      body: JSON.stringify({ offer }),
      headers: { 'content-type': 'application/json' },
    })
  )
}

describe('subscriptionTrialEnd', () => {
  const now = new Date('2026-09-25T12:00:00Z')

  it('is undefined with no pass or an expired one', () => {
    expect(subscriptionTrialEnd(null, now)).toBeUndefined()
    expect(subscriptionTrialEnd(new Date(now.getTime() - 1000), now)).toBeUndefined()
  })

  it('is the pass end in unix seconds', () => {
    const passEnd = new Date(now.getTime() + 20 * DAY_MS)
    expect(subscriptionTrialEnd(passEnd, now)).toBe(passEnd.getTime() / 1000)
  })

  it("is pushed to Stripe's 48h minimum when the pass ends sooner", () => {
    const passEnd = new Date(now.getTime() + 6 * 60 * 60 * 1000)
    expect(subscriptionTrialEnd(passEnd, now)).toBe(Math.ceil((now.getTime() + MIN_TRIAL_MS) / 1000))
  })
})

describe('POST /api/stripe/checkout', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_monthly'
    process.env.STRIPE_PRICE_PASS_30D = 'price_pass'
    mocks.passEnd = null
    mocks.sessionsCreate.mockClear()
  })

  it('starts monthly billing when an active pass ends', async () => {
    mocks.passEnd = new Date(Date.now() + 12 * DAY_MS)
    const res = await checkout('monthly')
    expect(res.status).toBe(200)
    const params = mocks.sessionsCreate.mock.calls[0][0] as { mode: string; subscription_data: { trial_end?: number } }
    expect(params.mode).toBe('subscription')
    expect(params.subscription_data.trial_end).toBe(Math.ceil(mocks.passEnd.getTime() / 1000))
  })

  it('bills immediately with no pass', async () => {
    const res = await checkout('monthly')
    expect(res.status).toBe(200)
    const params = mocks.sessionsCreate.mock.calls[0][0] as { subscription_data: Record<string, unknown> }
    expect(params.subscription_data).not.toHaveProperty('trial_end')
  })

  it('never sets a trial on a pass purchase', async () => {
    mocks.passEnd = new Date(Date.now() + 12 * DAY_MS)
    await checkout('pass')
    const params = mocks.sessionsCreate.mock.calls[0][0] as Record<string, unknown>
    expect(params.mode).toBe('payment')
    expect(params).not.toHaveProperty('subscription_data')
  })
})
