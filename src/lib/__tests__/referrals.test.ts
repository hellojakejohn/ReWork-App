// Referrals with a mocked database: linking at sign-up, paying out once, the referrer cap,
// days stacked after an existing pass, and failing soft when the tables are missing.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  codes: [] as { userId: string; code: string }[],
  referrals: [] as any[],
  entitlements: [] as any[],
  events: [] as any[],
  missingTables: false,
}))

const missing = () => {
  if (db.missingTables) throw Object.assign(new Error('relation "referrals" does not exist'), { code: 'P2021' })
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    referralCode: {
      findUnique: vi.fn(async ({ where }: any) => {
        missing()
        return db.codes.find((c) => (where.userId ? c.userId === where.userId : c.code === where.code)) ?? null
      }),
      create: vi.fn(async ({ data }: any) => {
        missing()
        db.codes.push(data)
        return data
      }),
    },
    referral: {
      findUnique: vi.fn(async ({ where }: any) => {
        missing()
        return db.referrals.find((r) => r.referredId === where.referredId) ?? null
      }),
      create: vi.fn(async ({ data }: any) => {
        missing()
        if (db.referrals.some((r) => r.referredId === data.referredId)) throw Object.assign(new Error('unique'), { code: 'P2002' })
        db.referrals.push({ id: `r${db.referrals.length}`, rewardedAt: null, referrerRewarded: false, ...data })
      }),
      count: vi.fn(async ({ where }: any) => {
        missing()
        return db.referrals.filter(
          (r) =>
            r.referrerId === where.referrerId &&
            (where.referrerRewarded === undefined || r.referrerRewarded === where.referrerRewarded) &&
            (where.rewardedAt?.gte ? r.rewardedAt && r.rewardedAt >= where.rewardedAt.gte : true) &&
            (where.rewardedAt?.not === null ? !!r.rewardedAt : true)
        ).length
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const r = db.referrals.find((x) => x.id === where.id && x.rewardedAt === null)
        if (!r) return { count: 0 }
        Object.assign(r, data)
        return { count: 1 }
      }),
    },
    entitlement: {
      findFirst: vi.fn(async ({ where }: any) => {
        const rows = db.entitlements
          .filter((e) => e.userId === where.userId && e.source === where.source && e.endsAt > where.endsAt.gt)
          .sort((a, b) => b.endsAt - a.endsAt)
        return rows[0] ? { endsAt: rows[0].endsAt } : null
      }),
      findMany: vi.fn(async ({ where }: any) => db.entitlements.filter((e) => e.userId === where.userId)),
      create: vi.fn(async ({ data }: any) => db.entitlements.push(data)),
    },
    user: { update: vi.fn(async () => ({})) },
    event: { create: vi.fn(async ({ data }: any) => db.events.push(data)) },
  },
}))

import { ensureInviteCode, linkReferral, referralStatus, rewardReferral } from '@/lib/referrals'
import { REFERRAL_DAYS, REFERRER_MONTHLY_CAP } from '@/lib/referral-rules'

const DAY = 86_400_000
const now = new Date('2026-11-22T12:00:00Z')

beforeEach(() => {
  db.codes = []
  db.referrals = []
  db.entitlements = []
  db.events = []
  db.missingTables = false
})

describe('referrals', () => {
  it('links a new user to the code owner, never to themselves', async () => {
    const code = (await ensureInviteCode('amy'))!
    expect(await ensureInviteCode('amy')).toBe(code)
    await linkReferral('amy', code)
    expect(db.referrals).toHaveLength(0)
    await linkReferral('ben', code.toLowerCase())
    expect(db.referrals).toMatchObject([{ referrerId: 'amy', referredId: 'ben' }])
    await linkReferral('cal', 'NOTACODE')
    expect(db.referrals).toHaveLength(1)
  })

  it('pays both sides once, on the first tailor', async () => {
    const code = (await ensureInviteCode('amy'))!
    await linkReferral('ben', code)
    expect(await rewardReferral('ben', now)).toBe(REFERRAL_DAYS)
    expect(await rewardReferral('ben', now)).toBe(0)
    expect(db.entitlements.map((e) => e.userId).sort()).toEqual(['amy', 'ben'])
    expect(db.entitlements.every((e) => e.source === 'COMP' && e.endsAt - e.startsAt === REFERRAL_DAYS * DAY)).toBe(true)
    const status = await referralStatus('amy')
    expect(status).toMatchObject({ joined: 1, rewarded: 1, daysEarned: REFERRAL_DAYS })
  })

  it('does nothing for a user nobody invited', async () => {
    expect(await rewardReferral('solo', now)).toBe(0)
    expect(db.entitlements).toHaveLength(0)
  })

  it('stacks the days after a running pass', async () => {
    const passEnd = new Date(now.getTime() + 30 * DAY)
    db.entitlements.push({ userId: 'ben', source: 'STRIPE_PASS', status: 'ACTIVE', startsAt: now, endsAt: passEnd })
    await linkReferral('ben', (await ensureInviteCode('amy'))!)
    await rewardReferral('ben', now)
    const comp = db.entitlements.find((e) => e.userId === 'ben' && e.source === 'COMP')
    expect(comp.startsAt.getTime()).toBe(passEnd.getTime())
  })

  it('caps the referrer per month, but the friend still gets theirs', async () => {
    const code = (await ensureInviteCode('amy'))!
    for (let i = 0; i <= REFERRER_MONTHLY_CAP; i++) {
      await linkReferral(`f${i}`, code)
      await rewardReferral(`f${i}`, now)
    }
    const amy = db.entitlements.filter((e) => e.userId === 'amy')
    expect(amy).toHaveLength(REFERRER_MONTHLY_CAP)
    expect(db.entitlements.filter((e) => e.userId.startsWith('f'))).toHaveLength(REFERRER_MONTHLY_CAP + 1)
  })

  it('fails soft when the tables are missing', async () => {
    db.missingTables = true
    expect(await ensureInviteCode('amy')).toBeNull()
    expect(await referralStatus('amy')).toBeNull()
    await expect(linkReferral('ben', 'AB2CD3EF')).resolves.toBeUndefined()
    expect(await rewardReferral('ben', now)).toBe(0)
  })
})
