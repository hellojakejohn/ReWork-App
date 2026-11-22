import { describe, expect, it } from 'vitest'
import { CODE_LENGTH, REFERRER_MONTHLY_CAP, cleanInviteCode, inviteLink, newInviteCode, referrerEligible, startOfUtcMonth } from '@/lib/referral-rules'
import { sourceFromVisit } from '@/lib/signup-source'

describe('invite codes', () => {
  it('are 8 unambiguous characters', () => {
    for (let i = 0; i < 200; i++) {
      const code = newInviteCode()
      expect(code).toHaveLength(CODE_LENGTH)
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/)
    }
    expect(newInviteCode(() => new Uint8Array(8))).toBe('AAAAAAAA')
  })

  it('clean only codes that could be ours', () => {
    expect(cleanInviteCode(' ab2cd3ef ')).toBe('AB2CD3EF')
    expect(cleanInviteCode('AB0CD3EF')).toBeNull() // 0 isn't in the alphabet
    expect(cleanInviteCode('SHORT')).toBeNull()
    expect(cleanInviteCode(null)).toBeNull()
  })

  it('builds the link', () => {
    expect(inviteLink('https://rework.careers/', 'AB2CD3EF')).toBe('https://rework.careers/?invite=AB2CD3EF')
  })
})

describe('referrer cap', () => {
  it('stops the referrer side at the monthly cap', () => {
    expect(referrerEligible(0)).toBe(true)
    expect(referrerEligible(REFERRER_MONTHLY_CAP - 1)).toBe(true)
    expect(referrerEligible(REFERRER_MONTHLY_CAP)).toBe(false)
    expect(startOfUtcMonth(new Date('2026-11-22T15:00:00Z')).toISOString()).toBe('2026-11-01T00:00:00.000Z')
  })
})

describe('invite links as a signup source', () => {
  it('count as "invite"', () => {
    expect(sourceFromVisit(new URL('https://rework.careers/?invite=AB2CD3EF'), null)).toMatchObject({ s: 'invite', t: true })
  })
})
