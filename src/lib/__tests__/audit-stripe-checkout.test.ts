// Launch audit (Stripe): checkout route params, URLs, customer reuse and duplicate-subscription
/* eslint-disable @typescript-eslint/no-unused-vars -- mock signatures keep their params for typed mock.calls */
// guards. Mocked Stripe and Prisma. it.fails = gap, correct behaviour in a comment.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  user: { id: 'user_1', email: 'j@x.io', stripeCustomerId: 'cus_1' as string | null },
  subRow: null as { id: string } | null,
  stripeSubs: [] as { id: string; status: string }[],
  listError: null as Error | null,
  sessionsCreate: vi.fn(async (params: Record<string, unknown>) => ({ url: 'https://checkout.stripe.test/s', params })),
  customersCreate: vi.fn(async (_p: unknown, _o: unknown) => ({ id: 'cus_new' })),
}))

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'user_1', email: 'j@x.io' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/track', () => ({ track: vi.fn(async () => {}) }))
vi.mock('@/lib/entitlements', () => ({ currentChainEnd: vi.fn(async () => null) }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(async () => ({ ...m.user })), update: vi.fn() },
    entitlement: { findFirst: vi.fn(async () => m.subRow) },
  },
}))
vi.mock('@/lib/stripe', async (orig) => {
  const actual = await orig<typeof import('@/lib/stripe')>()
  return {
    ...actual,
    getStripe: () => ({
      subscriptions: {
        list: vi.fn(async () => {
          if (m.listError) throw m.listError
          return { data: m.stripeSubs }
        }),
      },
      customers: { create: m.customersCreate },
      checkout: { sessions: { create: m.sessionsCreate } },
    }),
  }
})

import { POST } from '@/app/api/stripe/checkout/route'

const checkout = (offer: 'monthly' | 'pass', origin = 'https://rework.test') =>
  POST(new NextRequest(`${origin}/api/stripe/checkout`, { method: 'POST', body: JSON.stringify({ offer, returnTo: '/pricing' }), headers: { 'content-type': 'application/json' } }))
const lastParams = () => m.sessionsCreate.mock.calls.at(-1)![0] as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_x'
  process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_monthly'
  process.env.STRIPE_PRICE_PASS = 'price_pass'
  delete process.env.NEXTAUTH_URL
  m.user = { id: 'user_1', email: 'j@x.io', stripeCustomerId: 'cus_1' }
  m.subRow = null
  m.stripeSubs = []
  m.listError = null
  vi.clearAllMocks()
})

describe('session params', () => {
  it('Pro: subscription mode, env price, user id in client_reference_id + metadata + subscription metadata, promo codes on', async () => {
    expect((await checkout('monthly')).status).toBe(200)
    const p = lastParams()
    expect(p).toMatchObject({
      mode: 'subscription',
      customer: 'cus_1',
      client_reference_id: 'user_1',
      metadata: { userId: 'user_1', offer: 'monthly' },
      line_items: [{ price: 'price_monthly', quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: { metadata: { userId: 'user_1', offer: 'monthly' } },
    })
  })

  it('Pass: payment mode, env price, payment_intent metadata', async () => {
    await checkout('pass')
    expect(lastParams()).toMatchObject({ mode: 'payment', line_items: [{ price: 'price_pass', quantity: 1 }], payment_intent_data: { metadata: { userId: 'user_1' } } })
  })

  it('no automatic_tax and no customer_update (Stripe Tax is off; decision for Jake)', async () => {
    await checkout('pass')
    expect(lastParams().automatic_tax).toBeUndefined()
  })

  it('success/cancel URLs use NEXTAUTH_URL when set (a preview deploy with prod NEXTAUTH_URL returns users to prod)', async () => {
    process.env.NEXTAUTH_URL = 'https://rework.app/'
    await checkout('pass', 'https://rework-git-branch.vercel.app')
    expect(lastParams().success_url).toBe('https://rework.app/dashboard?checkout=success&offer=pass')
    expect(lastParams().cancel_url).toBe('https://rework.app/pricing')
  })

  it('falls back to the request origin when NEXTAUTH_URL is unset', async () => {
    await checkout('pass', 'https://rework-git-branch.vercel.app')
    expect(lastParams().success_url).toBe('https://rework-git-branch.vercel.app/dashboard?checkout=success&offer=pass')
  })
})

describe('one subscription per user', () => {
  it('409 for Pro while a subscription row is ACTIVE/PAST_DUE', async () => {
    m.subRow = { id: 'ent_1' }
    const res = await checkout('monthly')
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('already_subscribed')
  })

  it('409 when Stripe has a live subscription the webhook has not recorded yet', async () => {
    for (const status of ['active', 'trialing', 'past_due', 'unpaid']) {
      m.stripeSubs = [{ id: 'sub_1', status }]
      expect((await checkout('monthly')).status).toBe(409)
    }
  })

  it('409 for a Pass while subscribed (Pro -> Pass needs a cancel first)', async () => {
    m.subRow = { id: 'ent_1' }
    expect((await (await checkout('pass')).json()).code).toBe('pass_while_subscribed')
  })

  it("an 'incomplete' subscription (3DS pending) does not block a second checkout", async () => {
    m.stripeSubs = [{ id: 'sub_1', status: 'incomplete' }]
    expect((await checkout('monthly')).status).toBe(200)
  })

  // Correct: the second of two concurrent (or two open, unpaid) Pro checkouts must not be able
  // to create a second subscription. The pre-check cannot see a session that is open but not
  // yet paid. Fix in Stripe (Checkout setting "Limit customers to one subscription") and/or in
  // the webhook (cancel + refund a second live subscription for the same customer).
  it.fails('two Pro checkouts opened before either is paid: only one session is created', async () => {
    const [a, b] = await Promise.all([checkout('monthly'), checkout('monthly')])
    expect([a.status, b.status].sort()).toEqual([200, 409])
  })
})

describe('customer reuse', () => {
  it('reuses the stored customer', async () => {
    await checkout('pass')
    expect(m.customersCreate).not.toHaveBeenCalled()
    expect(lastParams().customer).toBe('cus_1')
  })

  it('concurrent first checkouts send the same idempotency key, so Stripe returns one customer (within 24h)', async () => {
    m.user = { id: 'user_1', email: 'j@x.io', stripeCustomerId: null }
    await Promise.all([checkout('pass'), checkout('monthly')])
    const keys = m.customersCreate.mock.calls.map((c) => (c[1] as { idempotencyKey: string }).idempotencyKey)
    expect(keys).toEqual(['customer-create-user_1', 'customer-create-user_1'])
  })

  // A stored customer id that does not exist in the current mode (test-mode cus_ ids left in
  // the DB when switching to sk_live, or a customer deleted in the dashboard) is replaced.
  it('a stale customer id (No such customer) recovers instead of failing checkout', async () => {
    m.listError = Object.assign(new Error("No such customer: 'cus_1'"), { code: 'resource_missing', type: 'StripeInvalidRequestError' })
    expect((await checkout('pass')).status).toBe(200)
  })
})
