import { describe, expect, it } from 'vitest'
import {
  DAY_MS,
  describeAccess,
  isLive,
  mapStripeSubscriptionStatus,
  passWindow,
  restackPasses,
  summarizeAccess,
  type EntitlementLike,
} from '@/lib/entitlement-rules'

const now = new Date('2026-09-25T12:00:00Z')
const days = (n: number) => new Date(now.getTime() + n * DAY_MS)

function row(partial: Partial<EntitlementLike>): EntitlementLike {
  return {
    source: 'STRIPE_PASS',
    status: 'ACTIVE',
    startsAt: days(-1),
    endsAt: days(10),
    cancelAtPeriodEnd: false,
    pastDueAt: null,
    ...partial,
  }
}

describe('mapStripeSubscriptionStatus', () => {
  it.each([
    ['active', 'ACTIVE'],
    ['trialing', 'ACTIVE'],
    ['past_due', 'PAST_DUE'],
    ['unpaid', 'PAST_DUE'],
    ['canceled', 'CANCELED'],
    ['incomplete_expired', 'CANCELED'],
    ['incomplete', null],
    ['paused', null],
  ])('%s -> %s', (stripe, ours) => {
    expect(mapStripeSubscriptionStatus(stripe)).toBe(ours)
  })
})

describe('passWindow', () => {
  it('starts now when no pass is running', () => {
    const w = passWindow(now, null)
    expect(w.startsAt).toEqual(now)
    expect(w.endsAt).toEqual(days(30))
  })

  it('starts now when the previous pass already ended', () => {
    const w = passWindow(now, days(-5))
    expect(w.startsAt).toEqual(now)
    expect(w.endsAt).toEqual(days(30))
  })

  it('stacks 30 days onto the end of an active pass', () => {
    const w = passWindow(now, days(12))
    expect(w.startsAt).toEqual(days(12))
    expect(w.endsAt).toEqual(days(42))
  })

  it('honors a custom length (comps)', () => {
    expect(passWindow(now, null, 7).endsAt).toEqual(days(7))
  })
})

describe('restackPasses', () => {
  it('slides later passes back to close the gap left by a refund', () => {
    // Pass A: day -2 .. 28 (refunded), pass B stacked: 28 .. 58, bought on day -1
    const b = { id: 'b', startsAt: days(28), endsAt: days(58), createdAt: days(-1) }
    const [nb] = restackPasses([b], days(-2))
    expect(nb.startsAt).toEqual(days(-1)) // never before it was bought
    expect(nb.endsAt).toEqual(days(29))
  })

  it('keeps chain order and lengths', () => {
    const b = { id: 'b', startsAt: days(28), endsAt: days(58), createdAt: days(-2) }
    const c = { id: 'c', startsAt: days(58), endsAt: days(88), createdAt: days(-2) }
    const out = restackPasses([c, b], days(-2))
    expect(out.map((r) => r.id)).toEqual(['b', 'c'])
    expect(out[0].startsAt).toEqual(days(-2))
    expect(out[1].startsAt).toEqual(days(28))
    expect(out[1].endsAt).toEqual(days(58))
  })
})

describe('isLive', () => {
  it('ACTIVE inside the window is live', () => {
    expect(isLive(row({}), now)).toBe(true)
  })
  it('past endsAt is not live', () => {
    expect(isLive(row({ endsAt: days(-1) }), now)).toBe(false)
  })
  it('future-dated (stacked) row is not live yet', () => {
    expect(isLive(row({ startsAt: days(5), endsAt: days(35) }), now)).toBe(false)
  })
  it('open-ended subscription is live', () => {
    expect(isLive(row({ source: 'STRIPE_SUBSCRIPTION', endsAt: null }), now)).toBe(true)
  })
  it('renewing subscription gets a day of slack past period end, canceled one does not', () => {
    const sub = row({ source: 'STRIPE_SUBSCRIPTION', endsAt: new Date(now.getTime() - 60_000) })
    expect(isLive(sub, now)).toBe(true)
    expect(isLive({ ...sub, cancelAtPeriodEnd: true }, now)).toBe(false)
  })
  it('PAST_DUE is live for 3 days, then not', () => {
    const s = row({ source: 'STRIPE_SUBSCRIPTION', status: 'PAST_DUE', endsAt: days(25) })
    expect(isLive({ ...s, pastDueAt: days(-2) }, now)).toBe(true)
    expect(isLive({ ...s, pastDueAt: days(-4) }, now)).toBe(false)
  })
  it.each(['CANCELED', 'EXPIRED', 'REFUNDED'] as const)('%s is never live', (status) => {
    expect(isLive(row({ status }), now)).toBe(false)
  })
})

describe('summarizeAccess', () => {
  it('no rows -> free', () => {
    expect(summarizeAccess([], now).isPro).toBe(false)
  })

  it('stacked passes report the end of the chain', () => {
    const a = summarizeAccess([row({ endsAt: days(12) }), row({ startsAt: days(12), endsAt: days(42) })], now)
    expect(a).toMatchObject({ isPro: true, source: 'STRIPE_PASS', daysLeft: 42 })
    expect(describeAccess(a)).toBe('Job Hunt Pass, 42 days left')
  })

  it('prefers the subscription over a pass for display', () => {
    const a = summarizeAccess(
      [row({ endsAt: days(40) }), row({ source: 'STRIPE_SUBSCRIPTION', endsAt: days(30), cancelAtPeriodEnd: true })],
      now
    )
    expect(a.source).toBe('STRIPE_SUBSCRIPTION')
    expect(a.cancelAtPeriodEnd).toBe(true)
  })

  it('describes monthly renewing and canceled states', () => {
    const renewing = summarizeAccess([row({ source: 'STRIPE_SUBSCRIPTION', endsAt: new Date('2026-10-25T12:00:00Z') })], now)
    expect(describeAccess(renewing)).toBe('Pro via monthly, renews Oct 25')
    const canceled = summarizeAccess(
      [row({ source: 'STRIPE_SUBSCRIPTION', endsAt: new Date('2026-10-25T12:00:00Z'), cancelAtPeriodEnd: true })],
      now
    )
    expect(describeAccess(canceled)).toBe('Pro until Oct 25 (canceled)')
  })

  it('refunded pass grants nothing', () => {
    expect(summarizeAccess([row({ status: 'REFUNDED' })], now).isPro).toBe(false)
  })
})
