import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'

const mocks = vi.hoisted(() => ({
  entitlementCreate: vi.fn(),
  entitlementUpsert: vi.fn(),
  entitlementFindUnique: vi.fn(async () => null),
}))

vi.mock('@/lib/prisma', () => {
  const tx = {
    $executeRaw: vi.fn(),
    entitlement: {
      findUnique: mocks.entitlementFindUnique,
      findFirst: vi.fn(async () => null),
      create: mocks.entitlementCreate,
      upsert: mocks.entitlementUpsert,
    },
    user: { update: vi.fn() },
  }
  return {
    prisma: {
      ...tx,
      user: { findUnique: vi.fn(async () => ({ id: 'user_1' })), updateMany: vi.fn(), update: vi.fn() },
      entitlement: { ...tx.entitlement, findMany: vi.fn(async () => []) },
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    },
  }
})

import { STRIPE_API_VERSION, WEBHOOK_EVENTS, checkStripePrices, checkStripeWebhook, isConfiguredPrice } from '@/lib/stripe'
import { grantPassFromCheckout, syncSubscription } from '@/lib/stripe-sync'
import { PRICING } from '@/lib/plans'

const ENV = ['STRIPE_PRICE_PRO_MONTHLY', 'STRIPE_PRICE_PASS', 'STRIPE_PRICE_PASS_30D']
let saved: Record<string, string | undefined> = {}
beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]))
  process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_monthly'
  process.env.STRIPE_PRICE_PASS = 'price_pass'
  delete process.env.STRIPE_PRICE_PASS_30D
  vi.clearAllMocks()
})
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

const price = (p: Partial<Stripe.Price>) => ({ currency: 'usd', active: true, livemode: false, type: 'one_time', recurring: null, unit_amount: 0, ...p })
const stripeWithPrices = (prices: Record<string, ReturnType<typeof price>>) =>
  ({ prices: { retrieve: vi.fn(async (id: string) => prices[id]) } }) as unknown as Stripe

describe('isConfiguredPrice', () => {
  it('matches only the env price id, never a missing one', () => {
    expect(isConfiguredPrice(PRICING.pass, 'price_pass')).toBe(true)
    expect(isConfiguredPrice(PRICING.pass, 'price_monthly')).toBe(false)
    expect(isConfiguredPrice(PRICING.pass, null)).toBe(false)
    delete process.env.STRIPE_PRICE_PASS
    process.env.STRIPE_PRICE_PASS_30D = 'price_old'
    expect(isConfiguredPrice(PRICING.pass, 'price_old')).toBe(false)
  })
})

describe('checkStripePrices', () => {
  const offers = [PRICING.monthly, PRICING.pass]

  it('passes when amounts, currency and type match plans.ts', async () => {
    const stripe = stripeWithPrices({
      price_monthly: price({ type: 'recurring', recurring: { interval: 'month' } as Stripe.Price.Recurring, unit_amount: 1500 }),
      price_pass: price({ unit_amount: 2900 }),
    })
    const result = await checkStripePrices(stripe, offers)
    expect(result.monthly.ok).toBe(true)
    expect(result.pass.ok).toBe(true)
  })

  it('fails on the old $9 / $15 prices, the wrong type, and a missing env var', async () => {
    const stripe = stripeWithPrices({
      price_monthly: price({ type: 'recurring', recurring: { interval: 'month' } as Stripe.Price.Recurring, unit_amount: 900 }),
      price_pass: price({ type: 'recurring', recurring: { interval: 'month' } as Stripe.Price.Recurring, unit_amount: 1500 }),
    })
    const result = await checkStripePrices(stripe, offers)
    expect(result.monthly).toMatchObject({ ok: false, detail: expect.stringContaining('unit_amount 900 (expected 1500)') })
    expect(result.pass.ok).toBe(false)
    expect(result.pass.detail).toMatch(/expected 2900.*not a one-time price/)

    delete process.env.STRIPE_PRICE_PASS
    expect((await checkStripePrices(stripe, offers)).pass).toMatchObject({ ok: false, detail: 'STRIPE_PRICE_PASS is not set' })
  })
})

describe('webhook grants only configured prices', () => {
  const session = { id: 'cs_1', payment_status: 'paid', client_reference_id: 'user_1', customer: 'cus_1', metadata: {} } as unknown as Stripe.Checkout.Session
  const stripeWithLineItem = (priceId: string) =>
    ({ checkout: { sessions: { listLineItems: vi.fn(async () => ({ data: [{ price: { id: priceId } }] })) } } }) as unknown as Stripe

  it('grants a pass for STRIPE_PRICE_PASS', async () => {
    await grantPassFromCheckout(stripeWithLineItem('price_pass'), session)
    expect(mocks.entitlementCreate).toHaveBeenCalledTimes(1)
  })

  it('grants nothing for any other price (old pass price, stray product)', async () => {
    await grantPassFromCheckout(stripeWithLineItem('price_old_15'), session)
    expect(mocks.entitlementCreate).not.toHaveBeenCalled()
  })

  const sub = (priceId: string) =>
    ({
      subscriptions: {
        retrieve: vi.fn(async () => ({
          id: 'sub_1',
          status: 'active',
          customer: 'cus_1',
          metadata: { userId: 'user_1' },
          start_date: 1_700_000_000,
          cancel_at: null,
          cancel_at_period_end: false,
          ended_at: null,
          items: { data: [{ price: { id: priceId }, current_period_end: 1_900_000_000 }] },
        })),
      },
    }) as unknown as Stripe

  it('creates a subscription entitlement only for STRIPE_PRICE_PRO_MONTHLY', async () => {
    await syncSubscription(sub('price_other'), 'sub_1')
    expect(mocks.entitlementUpsert).not.toHaveBeenCalled()
    await syncSubscription(sub('price_monthly'), 'sub_1')
    expect(mocks.entitlementUpsert).toHaveBeenCalledTimes(1)
  })

  it('keeps syncing a subscription it already tracks after a price change', async () => {
    mocks.entitlementFindUnique.mockResolvedValueOnce({ status: 'ACTIVE', pastDueAt: null } as never)
    await syncSubscription(sub('price_monthly_v2'), 'sub_1')
    expect(mocks.entitlementUpsert).toHaveBeenCalledTimes(1)
  })
})

describe('mode and webhook checks', () => {
  it('flags a test-mode price behind a live key', async () => {
    const savedKey = process.env.STRIPE_SECRET_KEY
    process.env.STRIPE_SECRET_KEY = 'sk_live_x'
    try {
      const result = await checkStripePrices(stripeWithPrices({ price_pass: price({ unit_amount: 2900 }) }), [PRICING.pass])
      expect(result.pass).toMatchObject({ ok: false, detail: expect.stringContaining('test mode but the key is live') })
    } finally {
      if (savedKey === undefined) delete process.env.STRIPE_SECRET_KEY
      else process.env.STRIPE_SECRET_KEY = savedKey
    }
  })

  const withEndpoints = (data: Partial<Stripe.WebhookEndpoint>[]) =>
    ({ webhookEndpoints: { list: vi.fn(async () => ({ data })) } }) as unknown as Stripe
  const good = {
    url: 'https://rework.test/api/stripe/webhook',
    status: 'enabled',
    enabled_events: [...WEBHOOK_EVENTS],
    api_version: STRIPE_API_VERSION,
    livemode: false,
  } as Partial<Stripe.WebhookEndpoint>

  it('passes for an enabled endpoint with every event on the pinned version', async () => {
    expect(await checkStripeWebhook(withEndpoints([good]), 'https://rework.test/')).toMatchObject({ ok: true })
  })

  it('names a missing endpoint, missing events and an API version mismatch', async () => {
    expect((await checkStripeWebhook(withEndpoints([]), 'https://rework.test')).detail).toContain('no webhook endpoint')
    const drifted = await checkStripeWebhook(
      withEndpoints([{ ...good, enabled_events: ['checkout.session.completed'], api_version: '2026-08-26.dahlia' }] as never),
      'https://rework.test'
    )
    expect(drifted.ok).toBe(false)
    expect(drifted.detail).toContain('missing events: checkout.session.async_payment_succeeded')
    expect(drifted.detail).toContain('endpoint API version 2026-08-26.dahlia')
  })
})
