// Launch audit (Stripe): webhook route. Real signature verification (stripe-node's
/* eslint-disable @typescript-eslint/no-unused-vars -- mock signatures keep their params for typed mock.calls */
// generateTestHeaderString), mocked handlers and DB. it.fails = gap, correct behaviour in a comment.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Stripe from 'stripe'
import { NextRequest } from 'next/server'

const SECRET = 'whsec_audit_test'
const real = new Stripe('sk_test_audit', { apiVersion: '2026-02-25.clover' })

const m = vi.hoisted(() => ({
  seen: new Set<string>(),
  key: 'sk_test_audit',
  syncSubscription: vi.fn(async (..._a: unknown[]) => {}),
  grantPassFromCheckout: vi.fn(async (..._a: unknown[]) => {}),
  refundPassFromCharge: vi.fn(async (..._a: unknown[]) => {}),
  revokePassForDispute: vi.fn(async (..._a: unknown[]) => {}),
  forgetCustomer: vi.fn(async (..._a: unknown[]) => {}),
  invoiceRetrieve: vi.fn(async (id: string) => ({ id, status: 'open' })),
  userUpdateMany: vi.fn(async (..._a: unknown[]) => ({ count: 0 })),
  entitlementUpdateMany: vi.fn(async (..._a: unknown[]) => ({ count: 0 })),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    stripeEvent: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (m.seen.has(where.id) ? { id: where.id } : null)),
      create: vi.fn(async ({ data }: { data: { id: string } }) => {
        m.seen.add(data.id)
        return data
      }),
    },
    user: { updateMany: m.userUpdateMany },
    entitlement: { updateMany: m.entitlementUpdateMany },
  },
}))
vi.mock('@/lib/track', () => ({ track: vi.fn(async () => {}) }))
vi.mock('@/lib/stripe-sync', async (orig) => {
  const actual = await orig<typeof import('@/lib/stripe-sync')>()
  return {
    invoiceSubscriptionId: actual.invoiceSubscriptionId,
    syncSubscription: m.syncSubscription,
    grantPassFromCheckout: m.grantPassFromCheckout,
    refundPassFromCharge: m.refundPassFromCharge,
    revokePassForDispute: m.revokePassForDispute,
    forgetCustomer: m.forgetCustomer,
  }
})
vi.mock('@/lib/stripe', async (orig) => {
  const actual = await orig<typeof import('@/lib/stripe')>()
  return {
    ...actual,
    getStripe: () =>
      process.env.STRIPE_SECRET_KEY ? { webhooks: real.webhooks, invoices: { retrieve: m.invoiceRetrieve } } : null,
  }
})

import { POST } from '@/app/api/stripe/webhook/route'

let n = 0
function evt(type: string, object: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { id: `evt_${++n}`, object: 'event', type, api_version: '2026-08-26.dahlia', created: 1, livemode: false, data: { object }, ...extra }
}
function deliver(event: unknown, opts: { secret?: string; tamper?: boolean; noSig?: boolean } = {}) {
  const payload = JSON.stringify(event)
  const header = real.webhooks.generateTestHeaderString({ payload, secret: opts.secret ?? SECRET })
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (!opts.noSig) headers['stripe-signature'] = header
  return POST(new NextRequest('https://rework.test/api/stripe/webhook', { method: 'POST', body: opts.tamper ? payload.replace('}', ',"x":1}') : payload, headers }))
}

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_audit'
  process.env.STRIPE_WEBHOOK_SECRET = SECRET
  m.seen.clear()
  vi.clearAllMocks()
})

describe('signature', () => {
  it('503 when STRIPE_WEBHOOK_SECRET is missing (Stripe retries for up to 3 days)', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    expect((await deliver(evt('invoice.paid', {}))).status).toBe(503)
  })
  it('400 without a stripe-signature header, with the wrong secret, or on a modified raw body', async () => {
    expect((await deliver(evt('invoice.paid', {}), { noSig: true })).status).toBe(400)
    expect((await deliver(evt('invoice.paid', {}), { secret: 'whsec_other' })).status).toBe(400)
    expect((await deliver(evt('invoice.paid', {}), { tamper: true })).status).toBe(400)
  })
  it('200 on a valid signature over the raw body', async () => {
    expect((await deliver(evt('invoice.paid', { id: 'in_1', parent: { subscription_details: { subscription: 'sub_1' } } }))).status).toBe(200)
    expect(m.syncSubscription).toHaveBeenCalledWith(expect.anything(), 'sub_1')
  })
})

describe('routing and idempotency', () => {
  it('handles exactly these 8 types', async () => {
    const cs = { id: 'cs_1', mode: 'payment', payment_status: 'paid', metadata: {} }
    await deliver(evt('checkout.session.completed', cs))
    await deliver(evt('checkout.session.async_payment_succeeded', cs))
    expect(m.grantPassFromCheckout).toHaveBeenCalledTimes(2)
    for (const t of ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'])
      await deliver(evt(t, { id: 'sub_1' }))
    await deliver(evt('invoice.paid', { id: 'in_1', parent: { subscription_details: { subscription: 'sub_1' } } }))
    await deliver(evt('invoice.payment_failed', { id: 'in_2', parent: { subscription_details: { subscription: 'sub_1' } } }))
    expect(m.syncSubscription).toHaveBeenCalledTimes(5)
    expect(m.syncSubscription).toHaveBeenLastCalledWith(expect.anything(), 'sub_1', { forcePastDue: true })
    await deliver(evt('charge.refunded', { id: 'ch_1' }))
    expect(m.refundPassFromCharge).toHaveBeenCalledTimes(1)
  })

  it('a redelivered event id is skipped after it was recorded', async () => {
    const e = evt('customer.subscription.updated', { id: 'sub_1' })
    await deliver(e)
    const res = await deliver(e)
    expect(await res.json()).toMatchObject({ duplicate: true })
    expect(m.syncSubscription).toHaveBeenCalledTimes(1)
  })

  it('concurrent duplicate deliveries both run the handler (event id is stored after handling); handlers must be idempotent', async () => {
    const e = evt('customer.subscription.updated', { id: 'sub_1' })
    await Promise.all([deliver(e), deliver(e)])
    expect(m.syncSubscription).toHaveBeenCalledTimes(2)
  })

  it('a handler error returns 500 and is not recorded, so Stripe retries', async () => {
    m.syncSubscription.mockRejectedValueOnce(new Error('db down'))
    const e = evt('customer.subscription.updated', { id: 'sub_1' })
    expect((await deliver(e)).status).toBe(500)
    expect(m.seen.has(e.id)).toBe(false)
  })

  it('event.api_version is ignored: a dahlia payload is processed by clover-typed code', async () => {
    const res = await deliver(evt('customer.subscription.updated', { id: 'sub_1' }, { api_version: '2026-08-26.dahlia' }))
    expect(res.status).toBe(200)
  })
})

describe('launch-audit fixes', () => {
  // A dispute on a $29 pass: the pass stops now (the buyer no longer keeps 90 days).
  it('charge.dispute.created revokes the disputed pass', async () => {
    await deliver(evt('charge.dispute.created', { id: 'dp_1', charge: 'ch_1', payment_intent: 'pi_1' }))
    expect(m.revokePassForDispute).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'dp_1' }))
  })

  // The next checkout creates a new customer instead of failing with "No such customer".
  it('customer.deleted unlinks the Stripe customer from the user', async () => {
    await deliver(evt('customer.deleted', { id: 'cus_1', object: 'customer', deleted: true }))
    expect(m.forgetCustomer).toHaveBeenCalledWith('cus_1')
  })

  // An event whose livemode does not match the key's mode is acknowledged and ignored.
  it('a livemode:true event is not applied when the server runs a test key (and vice versa)', async () => {
    await deliver(evt('customer.subscription.updated', { id: 'sub_1' }, { livemode: true }))
    expect(m.syncSubscription).not.toHaveBeenCalled()
  })
})
