// Daily ceilings apply to everyone (Pro included), per UTC day, counted from events.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ count: vi.fn(async (_args: unknown) => 0) }))
vi.mock('@/lib/prisma', () => ({ prisma: { event: { count: db.count } } }))

import { CEILING_EVENTS, checkDailyCeiling, startOfUtcDay } from '@/lib/daily-ceiling'
import { DAILY_CEILINGS, dailyCeilingMessage } from '@/lib/plans'

beforeEach(() => db.count.mockReset().mockResolvedValue(0))

describe('daily ceilings', () => {
  it('has the documented numbers', () => {
    expect(DAILY_CEILINGS).toEqual({ tailor: 40, coverLetter: 40, parse: 60 })
  })

  it('counts the matching event since UTC midnight for this user', async () => {
    const now = new Date('2026-10-01T23:30:00-05:00') // 04:30 UTC on Oct 2
    await checkDailyCeiling('user_1', 'tailor', now)
    expect(db.count).toHaveBeenCalledWith({
      where: { userId: 'user_1', name: 'tailored', createdAt: { gte: new Date('2026-10-02T00:00:00Z') } },
    })
    expect(startOfUtcDay(now).toISOString()).toBe('2026-10-02T00:00:00.000Z')
    expect(CEILING_EVENTS).toEqual({ tailor: 'tailored', coverLetter: 'cover_letter_generated', parse: 'resume_parsed' })
  })

  it('allows up to the limit and blocks at it', async () => {
    db.count.mockResolvedValueOnce(39)
    expect((await checkDailyCeiling('u', 'tailor')).allowed).toBe(true)
    db.count.mockResolvedValueOnce(40)
    const blocked = await checkDailyCeiling('u', 'tailor')
    expect(blocked).toMatchObject({ allowed: false, used: 40, limit: 40 })
    expect(blocked.message).toMatch(/today's limit of 40 tailored resumes.*midnight UTC/)
  })

  it('uses the parse ceiling for uploads', async () => {
    db.count.mockResolvedValueOnce(60)
    const res = await checkDailyCeiling('u', 'parse')
    expect(res.allowed).toBe(false)
    expect(db.count.mock.calls[0][0]).toMatchObject({ where: { name: 'resume_parsed' } })
    expect(dailyCeilingMessage('parse')).toMatch(/60 resume uploads/)
  })

  it('fails open when events cannot be read', async () => {
    db.count.mockRejectedValueOnce(new Error('relation "events" does not exist'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await checkDailyCeiling('u', 'coverLetter')).allowed).toBe(true)
    spy.mockRestore()
  })
})
