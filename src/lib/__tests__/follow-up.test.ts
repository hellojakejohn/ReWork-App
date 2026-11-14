import { describe, expect, it } from 'vitest'
import { addDaysISO, dueLine, followUpDue, followUpEmail, mailtoHref } from '@/lib/follow-up'

const now = new Date('2026-11-08T15:00:00')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString()

describe('followUpDue', () => {
  it('nudges after a quiet week in Applied', () => {
    expect(followUpDue({ status: 'APPLIED', appliedAt: daysAgo(6), statusUpdatedAt: daysAgo(6), followUpAt: null }, now)).toBeNull()
    expect(followUpDue({ status: 'APPLIED', appliedAt: daysAgo(9), statusUpdatedAt: daysAgo(9), followUpAt: null }, now)).toEqual({ column: 'applied', days: 9, reason: 'quiet' })
  })

  it('follows the date they set, and a future date snoozes it', () => {
    expect(followUpDue({ status: 'APPLIED', appliedAt: daysAgo(20), statusUpdatedAt: daysAgo(20), followUpAt: addDaysISO(now, 3) }, now)).toBeNull()
    expect(followUpDue({ status: 'APPLIED', appliedAt: daysAgo(2), statusUpdatedAt: daysAgo(2), followUpAt: '2026-11-08' }, now)?.reason).toBe('date')
    expect(followUpDue({ status: 'INTERVIEW', appliedAt: daysAgo(20), statusUpdatedAt: daysAgo(3), followUpAt: '2026-11-07' }, now)).toEqual({ column: 'interview', days: 3, reason: 'date' })
  })

  it('never nudges saved, offer or rejected jobs, or interviews without a date', () => {
    for (const status of ['DRAFT', 'OPTIMIZED', 'OFFER', 'REJECTED'] as const) {
      expect(followUpDue({ status, appliedAt: daysAgo(30), statusUpdatedAt: daysAgo(30), followUpAt: '2026-11-01' }, now)).toBeNull()
    }
    expect(followUpDue({ status: 'INTERVIEW', appliedAt: daysAgo(30), statusUpdatedAt: daysAgo(30), followUpAt: null }, now)).toBeNull()
  })

  it('says it plainly', () => {
    expect(dueLine({ column: 'applied', days: 9, reason: 'quiet' })).toBe('Applied 9 days ago, no reply yet')
  })
})

describe('followUpEmail', () => {
  it('names the role, company and date, signed with their name', () => {
    const e = followUpEmail({ jobTitle: 'Product Designer', company: 'Acme', appliedAt: '2026-10-30T12:00:00Z', column: 'applied' }, 'Jake Johnson')
    expect(e.subject).toBe('Following up on my Product Designer application')
    expect(e.body).toContain('the Product Designer role at Acme on October 30')
    expect(e.body.endsWith('Thank you,\nJake Johnson')).toBe(true)
    expect(e.body).not.toMatch(/—/)
  })

  it('has an interview version', () => {
    const e = followUpEmail({ jobTitle: 'Engineer', company: 'Acme', appliedAt: null, column: 'interview' }, '')
    expect(e.subject).toBe('Following up: Engineer interview')
    expect(e.body).toContain('next steps')
  })

  it('builds a mailto link', () => {
    expect(mailtoHref({ subject: 'Hi there', body: 'a&b' })).toBe('mailto:?subject=Hi%20there&body=a%26b')
  })
})
