// Launch audit (Stripe): entitlement sync against an in-memory Prisma. Passing tests prove
// current behaviour; it.fails tests demonstrate a gap, with the correct behaviour in a comment.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const db = vi.hoisted(() => {
  const state = { entitlements: [] as Row[], users: [] as Row[], seq: 0 }
  const cmp = (v: unknown, cond: unknown): boolean => {
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      const c = cond as Record<string, unknown>
      if ('in' in c) return (c.in as unknown[]).includes(v)
      if ('not' in c) return v !== c.not
      const t = (x: unknown) => (x instanceof Date ? x.getTime() : (x as number))
      if ('gt' in c && !(v != null && t(v) > t(c.gt))) return false
      if ('gte' in c && !(v != null && t(v) >= t(c.gte))) return false
      if ('lte' in c && !(v != null && t(v) <= t(c.lte))) return false
      return true
    }
    return v === cond
  }
  const match = (r: Row, where: Row = {}): boolean =>
    Object.entries(where).every(([k, cond]) => {
      if (k === 'source_externalId') return r.source === cond.source && r.externalId === cond.externalId
      if (k === 'OR') return (cond as Row[]).some((w) => match(r, w))
      return cmp(r[k], cond)
    })
  const entitlement = {
    findUnique: vi.fn(async ({ where }: Row) => state.entitlements.find((r) => match(r, where)) ?? null),
    findFirst: vi.fn(async ({ where, orderBy }: Row) => {
      let rows = state.entitlements.filter((r) => match(r, where))
      if (orderBy?.endsAt === 'desc') rows = rows.sort((a, b) => b.endsAt - a.endsAt)
      return rows[0] ?? null
    }),
    findMany: vi.fn(async ({ where }: Row = {}) => state.entitlements.filter((r) => match(r, where))),
    create: vi.fn(async ({ data }: Row) => {
      if (data.externalId && state.entitlements.some((r) => r.source === data.source && r.externalId === data.externalId))
        throw new Error('P2002 unique')
      const row = { id: `ent_${++state.seq}`, cancelAtPeriodEnd: false, pastDueAt: null, createdAt: new Date(), ...data }
      state.entitlements.push(row)
      return row
    }),
    upsert: vi.fn(async ({ where, create, update }: Row) => {
      const ex = state.entitlements.find((r) => match(r, where))
      if (ex) return Object.assign(ex, update)
      const row = { id: `ent_${++state.seq}`, cancelAtPeriodEnd: false, pastDueAt: null, createdAt: new Date(), ...create }
      state.entitlements.push(row)
      return row
    }),
    update: vi.fn(async ({ where, data }: Row) => Object.assign(state.entitlements.find((r) => r.id === where.id)!, data)),
    updateMany: vi.fn(async ({ where, data }: Row) => {
      const rows = state.entitlements.filter((r) => match(r, where))
      rows.forEach((r) => Object.assign(r, data))
      return { count: rows.length }
    }),
  }
  const user = {
    findUnique: vi.fn(async ({ where }: Row) => state.users.find((u) => match(u, where)) ?? null),
    update: vi.fn(async ({ where, data }: Row) => Object.assign(state.users.find((u) => u.id === where.id)!, data)),
    updateMany: vi.fn(async ({ where, data }: Row) => {
      const rows = state.users.filter((u) => match(u, where))
      rows.forEach((u) => Object.assign(u, data))
      return { count: rows.length }
    }),
  }
  const tx = { $executeRaw: vi.fn(async () => 0), entitlement, user }
  return { state, prisma: { ...tx, $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } }
})

vi.mock('@/lib/prisma', () => ({ prisma: db.prisma }))

import { grantPassFromCheckout, invoiceSubscriptionId, refundPassFromCharge, syncSubscription } from '@/lib/stripe-sync'
import { expireEntitlements, getAccess } from '@/lib/entitlements'
import { DAY_MS, PAST_DUE_GRACE_DAYS } from '@/lib/entitlement-rules'
import { PASS_DAYS } from '@/lib/plans'

const USER = 'user_1'
beforeEach(() => {
  db.state.entitlements = []
  db.state.users = [{ id: USER, stripeCustomerId: 'cus_1', plan: 'FREE' }]
  process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_monthly'
  process.env.STRIPE_PRICE_PASS = 'price_pass'
  vi.useRealTimers()
})

const session = (id: string, extra: Partial<Stripe.Checkout.Session> = {}) =>
  ({ id, mode: 'payment', payment_status: 'paid', client_reference_id: USER, customer: 'cus_1', metadata: { userId: USER }, ...extra }) as unknown as Stripe.Checkout.Session

const stripePass = (sessionsByPi: Record<string, string> = {}) =>
  ({
    checkout: {
      sessions: {
        listLineItems: vi.fn(async () => ({ data: [{ price: { id: 'price_pass' } }] })),
        list: vi.fn(async ({ payment_intent }: { payment_intent: string }) => ({
          data: sessionsByPi[payment_intent] ? [{ id: sessionsByPi[payment_intent], mode: 'payment' }] : [],
        })),
      },
    },
  }) as unknown as Stripe

const passes = () => db.state.entitlements.filter((r) => r.source === 'STRIPE_PASS')

describe('Job Hunt Pass grant', () => {
  it('is exactly PASS_DAYS (90) days', async () => {
    expect(PASS_DAYS).toBe(90)
    await grantPassFromCheckout(stripePass(), session('cs_1'))
    const [p] = passes()
    expect(p.endsAt.getTime() - p.startsAt.getTime()).toBe(90 * DAY_MS)
  })

  it('duplicate checkout.session.completed (and async_payment_succeeded) for one session grants once, never 180 days', async () => {
    const s = stripePass()
    await grantPassFromCheckout(s, session('cs_1'))
    await grantPassFromCheckout(s, session('cs_1'))
    await Promise.all([grantPassFromCheckout(s, session('cs_1')), grantPassFromCheckout(s, session('cs_1'))])
    expect(passes()).toHaveLength(1)
  })

  it('two different passes stack: 180 days from the first start, not from the second purchase', async () => {
    const s = stripePass()
    await grantPassFromCheckout(s, session('cs_1'))
    await grantPassFromCheckout(s, session('cs_2'))
    const [a, b] = passes()
    expect(b.startsAt.getTime()).toBe(a.endsAt.getTime())
    expect(b.endsAt.getTime() - a.startsAt.getTime()).toBe(180 * DAY_MS)
    const access = await getAccess(USER)
    expect(access.daysLeft).toBe(180)
  })

  it('access ends at endsAt at request time even if the expiry cron never runs', async () => {
    await grantPassFromCheckout(stripePass(), session('cs_1'))
    const end = passes()[0].endsAt as Date
    expect((await getAccess(USER, new Date(end.getTime() - 1000))).isPro).toBe(true)
    expect(passes()[0].status).toBe('ACTIVE') // cron has not run
    expect((await getAccess(USER, new Date(end.getTime() + 1000))).isPro).toBe(false)
  })

  it('expiry cron is idempotent (second run expires nothing)', async () => {
    await grantPassFromCheckout(stripePass(), session('cs_1'))
    const after = new Date((passes()[0].endsAt as Date).getTime() + 1000)
    expect((await expireEntitlements(after)).expired).toBe(1)
    expect((await expireEntitlements(after)).expired).toBe(0)
  })

  // A 100%-off promotion code (allow_promotion_codes is on) completes with payment_status
  // 'no_payment_required'; the buyer still gets the pass.
  it('a 100%-off promo code pass checkout grants the pass', async () => {
    await grantPassFromCheckout(stripePass(), session('cs_free', { payment_status: 'no_payment_required' }))
    expect(passes()).toHaveLength(1)
  })
})

describe('Pass refund', () => {
  it('full refund marks the pass REFUNDED and slides a stacked pass back to now', async () => {
    const s = stripePass({ pi_1: 'cs_1' })
    await grantPassFromCheckout(s, session('cs_1'))
    await grantPassFromCheckout(s, session('cs_2'))
    await refundPassFromCharge(s, { id: 'ch_1', refunded: true, payment_intent: 'pi_1' } as unknown as Stripe.Charge)
    const [a, b] = passes()
    expect(a.status).toBe('REFUNDED')
    expect(Math.abs(b.startsAt.getTime() - Date.now())).toBeLessThan(5000)
    expect((await getAccess(USER)).daysLeft).toBe(90)
  })

  it('partial refund leaves the pass in place', async () => {
    const s = stripePass({ pi_1: 'cs_1' })
    await grantPassFromCheckout(s, session('cs_1'))
    await refundPassFromCharge(s, { id: 'ch_1', refunded: false, payment_intent: 'pi_1' } as unknown as Stripe.Charge)
    expect(passes()[0].status).toBe('ACTIVE')
  })
})

const now = () => Math.floor(Date.now() / 1000)
const sub = (o: Partial<Record<string, unknown>> = {}) => ({
  id: 'sub_1',
  status: 'active',
  customer: 'cus_1',
  metadata: { userId: USER },
  start_date: now() - 10 * 86400,
  cancel_at: null,
  cancel_at_period_end: false,
  ended_at: null,
  items: { data: [{ price: { id: 'price_monthly' }, current_period_end: now() + 20 * 86400 }] },
  ...o,
})
const stripeSub = (...states: ReturnType<typeof sub>[]) => {
  const retrieve = vi.fn()
  states.forEach((s) => retrieve.mockResolvedValueOnce(s))
  retrieve.mockResolvedValue(states.at(-1))
  return { subscriptions: { retrieve } } as unknown as Stripe
}
const subRow = () => db.state.entitlements.find((r) => r.source === 'STRIPE_SUBSCRIPTION')

describe('Pro subscription', () => {
  it('cancel at period end keeps Pro until current_period_end, then drops it with no slack', async () => {
    const end = now() + 5 * 86400
    await syncSubscription(stripeSub(sub({ cancel_at_period_end: true, items: { data: [{ price: { id: 'price_monthly' }, current_period_end: end }] } })), 'sub_1')
    expect((await getAccess(USER)).cancelAtPeriodEnd).toBe(true)
    expect((await getAccess(USER, new Date(end * 1000 - 1000))).isPro).toBe(true)
    expect((await getAccess(USER, new Date(end * 1000 + 1000))).isPro).toBe(false)
  })

  it('newer portal cancellation (cancel_at set, cancel_at_period_end false) is treated the same', async () => {
    const end = now() + 5 * 86400
    await syncSubscription(stripeSub(sub({ cancel_at: end })), 'sub_1')
    expect(subRow()!.cancelAtPeriodEnd).toBe(true)
    expect(subRow()!.endsAt.getTime()).toBe(end * 1000)
  })

  it('reads current_period_end from the subscription item (basil+) and from the legacy top-level field', async () => {
    const end = now() + 7 * 86400
    await syncSubscription(stripeSub(sub({ items: { data: [{ price: { id: 'price_monthly' } }] }, current_period_end: end })), 'sub_1')
    expect(subRow()!.endsAt.getTime()).toBe(end * 1000)
  })

  it('past_due keeps Pro for the 3-day grace only; unpaid is treated the same', async () => {
    await syncSubscription(stripeSub(sub({ status: 'past_due' })), 'sub_1')
    const since = subRow()!.pastDueAt as Date
    expect((await getAccess(USER, new Date(since.getTime() + (PAST_DUE_GRACE_DAYS * DAY_MS) - 1000))).isPro).toBe(true)
    expect((await getAccess(USER, new Date(since.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS + 1000))).isPro).toBe(false)
    await syncSubscription(stripeSub(sub({ status: 'unpaid' })), 'sub_1')
    expect(subRow()!.status).toBe('PAST_DUE')
    expect(subRow()!.pastDueAt).toEqual(since) // grace clock not reset
  })

  it('deleted then a late updated: re-fetch keeps it CANCELED (no rollback from payload order)', async () => {
    const canceled = sub({ status: 'canceled', ended_at: now() })
    const s = stripeSub(canceled)
    await syncSubscription(s, 'sub_1') // customer.subscription.deleted
    await syncSubscription(s, 'sub_1') // late customer.subscription.updated
    expect(subRow()!.status).toBe('CANCELED')
    expect((await getAccess(USER)).isPro).toBe(false)
  })

  it('subscription.created before checkout.session.completed still finds the user via subscription metadata', async () => {
    await syncSubscription(stripeSub(sub()), 'sub_1') // no opts.userId
    expect(subRow()!.userId).toBe(USER)
  })

  // Correct: retrieve the subscription inside the per-user lock (or compare a version such as
  // event.created) so a slow, older read cannot overwrite a newer one. Today the retrieve at
  // stripe-sync.ts:50 happens before the lock at :77.
  it.fails('two concurrent syncs cannot write an older Stripe read over a newer one', async () => {
    let releaseOld!: () => void
    const oldRead = new Promise<void>((r) => (releaseOld = r))
    const stale = sub({ status: 'active' })
    const fresh = sub({ status: 'canceled', ended_at: now() })
    const stripe = {
      subscriptions: {
        retrieve: vi
          .fn()
          .mockImplementationOnce(async () => {
            await oldRead
            return stale
          })
          .mockImplementationOnce(async () => fresh),
      },
    } as unknown as Stripe
    const a = syncSubscription(stripe, 'sub_1') // read before cancellation, slow network
    const b = syncSubscription(stripe, 'sub_1') // read after cancellation
    await b
    releaseOld()
    await a
    expect(subRow()!.status).toBe('CANCELED')
  })
})

describe('invoice -> subscription id across API versions', () => {
  it('reads invoice.parent.subscription_details.subscription (basil+, clover, dahlia)', () => {
    expect(invoiceSubscriptionId({ parent: { subscription_details: { subscription: 'sub_new' } } } as unknown as Stripe.Invoice)).toBe('sub_new')
  })
  it('falls back to legacy invoice.subscription (acacia and older endpoints)', () => {
    expect(invoiceSubscriptionId({ parent: null, subscription: 'sub_old' } as unknown as Stripe.Invoice)).toBe('sub_old')
  })
})
