// Partner codes: the rules, and the grant at sign-up with the database faked.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  db: {
    event: { count: vi.fn() },
    entitlement: { create: vi.fn(async () => ({})) },
  },
  chainEnd: vi.fn(async (): Promise<Date | null> => null),
  mirror: vi.fn(async () => ({})),
  track: vi.fn(async () => {}),
}))
vi.mock('@/lib/prisma', () => ({ prisma: h.db }))
vi.mock('@/lib/entitlements', () => ({ currentChainEnd: h.chainEnd, refreshPlanMirror: h.mirror }))
vi.mock('@/lib/track', () => ({ track: h.track }))

import { PARTNERS, partnerBlock, partnerFor, partnerLink, type Partner } from '@/lib/partner-rules'
import { grantPartnerDays } from '@/lib/partners'
import { cleanTag } from '@/lib/signup-source'

const LIST: Record<string, Partner> = { 'careerforce-stp': { name: 'CareerForce Saint Paul', days: 30, cap: 2, until: '2027-03-31' } }
const NOW = new Date('2026-12-01T10:00:00Z')

describe('partner rules', () => {
  it('finds a code, and nothing else', () => {
    expect(partnerFor('careerforce-stp', LIST)).toMatchObject({ code: 'careerforce-stp', days: 30 })
    expect(partnerFor('x', LIST)).toBeNull()
    expect(partnerFor('constructor', LIST)).toBeNull()
    expect(partnerFor(null, LIST)).toBeNull()
    // The ?ref= tag reaches us cleaned: "CareerForce-STP" still matches.
    expect(partnerFor(cleanTag('CareerForce-STP'), LIST)?.code).toBe('careerforce-stp')
  })
  it('stops at the cap and after the end date', () => {
    const p = LIST['careerforce-stp']
    expect(partnerBlock(p, 1, NOW)).toBeNull()
    expect(partnerBlock(p, 2, NOW)).toBe('cap')
    expect(partnerBlock(p, 0, new Date('2027-03-31T23:00:00Z'))).toBeNull()
    expect(partnerBlock(p, 0, new Date('2027-04-01T00:00:00Z'))).toBe('ended')
  })
  it('builds the link', () => {
    expect(partnerLink('https://rework.careers/', 'careerforce-stp')).toBe('https://rework.careers/?ref=careerforce-stp')
  })
  it('every listed code has a cap and is a clean tag', () => {
    for (const [code, p] of Object.entries(PARTNERS)) {
      expect(cleanTag(code)).toBe(code)
      expect(p.cap).toBeGreaterThan(0)
      expect(p.days).toBeLessThanOrEqual(90)
    }
  })
})

describe('grantPartnerDays', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.db.event.count.mockResolvedValue(0)
    h.chainEnd.mockResolvedValue(null)
  })

  it('gives a new user the partner days as a comp', async () => {
    expect(await grantPartnerDays('u1', 'careerforce-stp', NOW, LIST)).toBe(30)
    const data = (h.db.entitlement.create.mock.calls[0] as any)[0].data
    expect(data).toMatchObject({ userId: 'u1', source: 'COMP', status: 'ACTIVE' })
    expect((data.endsAt.getTime() - data.startsAt.getTime()) / 86_400_000).toBe(30)
    expect(h.mirror).toHaveBeenCalledWith('u1')
    expect(h.track).toHaveBeenCalledWith('partner_joined', { code: 'careerforce-stp', days: 30 }, 'u1')
  })

  it('does nothing for a plain ref like x', async () => {
    expect(await grantPartnerDays('u1', 'x', NOW, LIST)).toBe(0)
    expect(h.db.event.count).not.toHaveBeenCalled()
  })

  it('logs but gives nothing once the cap is hit', async () => {
    h.db.event.count.mockResolvedValue(2)
    expect(await grantPartnerDays('u1', 'careerforce-stp', NOW, LIST)).toBe(0)
    expect(h.db.entitlement.create).not.toHaveBeenCalled()
    expect(h.track).toHaveBeenCalledWith('partner_joined', { code: 'careerforce-stp', days: 0, blocked: 'cap' }, 'u1')
  })

  it('never throws into sign-up', async () => {
    h.db.event.count.mockRejectedValue(new Error('db down'))
    expect(await grantPartnerDays('u1', 'careerforce-stp', NOW, LIST)).toBe(0)
  })
})
