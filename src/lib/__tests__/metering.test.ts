// Monthly limits: tailors (FREE 3), cover letters (FREE 1), tracker (FREE 10).
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  user: { monthlyTailors: 0, tailorsResetAt: new Date(), monthlyCoverLetters: 0, coverLettersResetAt: new Date() } as Record<string, unknown>,
  isPro: false,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async () => ({ ...db.user })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        for (const [key, value] of Object.entries(data)) {
          db.user[key] = value && typeof value === 'object' && 'increment' in value ? (db.user[key] as number) + (value as { increment: number }).increment : value
        }
        return db.user
      }),
    },
  },
}))
vi.mock('@/lib/entitlements', () => ({ getAccess: vi.fn(async () => ({ isPro: db.isPro })) }))

import {
  FREE_COVER_LETTERS_PER_MONTH,
  FREE_TAILORS_PER_MONTH,
  FREE_TRACKER_APPLICATIONS,
  canExportWord,
  canUseEvidenceInterview,
  FREE_FEATURES,
  PRO_FEATURES,
  coverLetterLimitFor,
  trackerLimitFor,
} from '@/lib/plans'
import { getCoverLetterQuota, getTailorQuota, incrementCoverLetterCount, isNewMonth, quotaDTO, quotaFrom } from '@/lib/tailor-quota'

describe('plan limits', () => {
  it('has the advertised FREE limits and unlimited Pro', () => {
    expect(FREE_TAILORS_PER_MONTH).toBe(3)
    expect(FREE_COVER_LETTERS_PER_MONTH).toBe(1)
    expect(FREE_TRACKER_APPLICATIONS).toBe(10)
    expect(coverLetterLimitFor(false)).toBe(1)
    expect(coverLetterLimitFor(true)).toBe(Infinity)
    expect(trackerLimitFor(false)).toBe(10)
    expect(trackerLimitFor(true)).toBe(Infinity)
    expect(canUseEvidenceInterview(false)).toBe(false)
    expect(canUseEvidenceInterview(true)).toBe(true)
    expect(canExportWord(false)).toBe(false)
    expect(canExportWord(true)).toBe(true)
  })

  it('pricing copy states the same limits', () => {
    expect(FREE_FEATURES).toEqual(['3 tailored resumes per month', '1 cover letter per month', 'Application tracker for up to 10 jobs', 'PDF downloads'])
    expect(PRO_FEATURES.join(' ')).toMatch(/Unlimited tailored resumes.*Unlimited cover letters.*Evidence interview.*Unlimited application tracker.*PDF \+ Word/)
  })
})

describe('quotaFrom', () => {
  const now = new Date('2026-09-25T12:00:00Z')
  it('blocks the second FREE cover letter in the same month', () => {
    expect(quotaFrom(0, new Date('2026-09-01T00:00:00Z'), false, 'coverLetter', now)).toMatchObject({ used: 0, remaining: 1, allowed: true })
    expect(quotaFrom(1, new Date('2026-09-01T00:00:00Z'), false, 'coverLetter', now)).toMatchObject({ used: 1, remaining: 0, allowed: false })
  })
  it('resets on a new UTC month', () => {
    expect(isNewMonth(new Date('2026-08-31T23:59:00Z'), now)).toBe(true)
    expect(quotaFrom(1, new Date('2026-08-31T23:59:00Z'), false, 'coverLetter', now)).toMatchObject({ used: 0, allowed: true })
  })
  it('never blocks Pro and serializes unlimited as null', () => {
    const q = quotaFrom(500, now, true, 'coverLetter', now)
    expect(q.allowed).toBe(true)
    expect(quotaDTO(q)).toEqual({ isPro: true, used: 500, limit: null, remaining: null })
  })
  it('keeps tailor and cover letter limits separate', () => {
    expect(quotaFrom(1, now, false, 'tailor', now).allowed).toBe(true)
    expect(quotaFrom(1, now, false, 'coverLetter', now).allowed).toBe(false)
  })
})

describe('getCoverLetterQuota / incrementCoverLetterCount', () => {
  beforeEach(() => {
    db.isPro = false
    db.user = { monthlyTailors: 0, tailorsResetAt: new Date(), monthlyCoverLetters: 0, coverLettersResetAt: new Date() }
  })

  it('uses its own counter, not the tailor one', async () => {
    expect((await getCoverLetterQuota('u1')).allowed).toBe(true)
    await incrementCoverLetterCount('u1')
    expect(db.user.monthlyCoverLetters).toBe(1)
    expect(db.user.monthlyTailors).toBe(0)
    expect((await getCoverLetterQuota('u1')).allowed).toBe(false)
    expect((await getTailorQuota('u1')).allowed).toBe(true)
  })

  it('starts a fresh month at 1 when the reset date is last month', async () => {
    db.user.monthlyCoverLetters = 7
    db.user.coverLettersResetAt = new Date(Date.UTC(2000, 0, 1))
    await incrementCoverLetterCount('u1')
    expect(db.user.monthlyCoverLetters).toBe(1)
  })

  it('lets Pro write as many as they want', async () => {
    db.isPro = true
    db.user.monthlyCoverLetters = 40
    expect((await getCoverLetterQuota('u1')).allowed).toBe(true)
  })
})
