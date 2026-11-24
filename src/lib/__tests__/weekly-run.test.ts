// The cron pass end to end with the DB, matching and Resend faked.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  db: {
    feedPrefs: { findMany: vi.fn() },
    event: { groupBy: vi.fn() },
    jobMatch: { findMany: vi.fn() },
    job: { count: vi.fn(async () => 33_000) },
    jobApplication: { count: vi.fn(async () => 0) },
    emailPrefs: { findUnique: vi.fn(), upsert: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 1 })) },
  },
  match: vi.fn(async () => ({ ok: true })),
  send: vi.fn(async () => ({ ok: true, id: 'em_1' })),
  track: vi.fn(async () => {}),
}))
vi.mock('@/lib/prisma', () => ({ prisma: h.db }))
vi.mock('@/lib/feed/feed-server', () => ({ matchForResume: h.match }))
vi.mock('@/lib/email/send', () => ({ sendEmail: h.send }))
vi.mock('@/lib/track', () => ({ track: h.track }))

import { runWeekly } from '@/lib/email/weekly'

const NOW = new Date('2026-11-23T13:00:00Z')
const person = (id: string, email: string) => ({
  userId: id,
  targetTitles: ['Analyst'],
  workplace: 'both',
  resume: { id: `r_${id}` },
  user: { id, email, name: 'Pat Doe' },
})
const match = (id: string) => ({
  id,
  rank: 80,
  score: 60,
  present: ['SQL'],
  related: [],
  dismissedAt: null,
  applicationId: null,
  job: { title: `Analyst ${id}`, company: 'Co', location: 'Remote', remote: true, payLabel: null, firstSeenAt: new Date(NOW.getTime() - 86_400_000), closedAt: null, keywords: ['SQL'] },
})

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXTAUTH_SECRET = 'test'
  h.db.feedPrefs.findMany.mockResolvedValue([person('u1', 'jake@example.com'), person('u2', 'pat@example.com')])
  h.db.event.groupBy.mockResolvedValue([{ userId: 'u1', _max: { createdAt: NOW } }, { userId: 'u2', _max: { createdAt: NOW } }])
  h.db.emailPrefs.findUnique.mockResolvedValue(null)
  h.db.emailPrefs.updateMany.mockResolvedValue({ count: 1 })
  h.db.jobMatch.findMany.mockResolvedValue([match('m1'), match('m2')])
})

describe('runWeekly', () => {
  it('off does nothing', async () => {
    const s = await runWeekly({ now: NOW, mode: 'off' })
    expect(s.considered).toBe(0)
    expect(h.db.feedPrefs.findMany).not.toHaveBeenCalled()
  })

  it('dry builds for everyone, spends and sends nothing, marks no one', async () => {
    const s = await runWeekly({ now: NOW, mode: 'dry' })
    expect(s).toMatchObject({ considered: 2, dry: 2, sent: 0 })
    expect(h.match).not.toHaveBeenCalled()
    expect(h.send).not.toHaveBeenCalled()
    expect(h.db.emailPrefs.updateMany).not.toHaveBeenCalled()
  })

  it('live refreshes matches, sends, and logs each send', async () => {
    const s = await runWeekly({ now: NOW, mode: 'live' })
    expect(s).toMatchObject({ sent: 2, failed: 0 })
    expect(h.match).toHaveBeenCalledTimes(2)
    const mail = (h.send.mock.calls[0] as unknown as [{ to: string; subject: string; unsubscribeUrl: string }])[0]
    expect(mail.to).toBe('jake@example.com')
    expect(mail.subject).toBe('Your measurements this week: 2 new jobs that fit')
    expect(mail.unsubscribeUrl).toMatch(/\/unsubscribe\?t=/)
    expect(h.track).toHaveBeenCalledWith('weekly_email', expect.objectContaining({ status: 'sent', jobs: 2 }), 'u1')
  })

  it('admins mode only sends to admin addresses', async () => {
    const before = process.env.ADMIN_EMAILS
    process.env.ADMIN_EMAILS = 'jake@example.com'
    try {
      const s = await runWeekly({ now: NOW, mode: 'admins' })
      expect(s.sent).toBe(1)
      expect(s.skipped.not_admin).toBe(1)
    } finally {
      if (before === undefined) delete process.env.ADMIN_EMAILS
      else process.env.ADMIN_EMAILS = before
    }
  })

  it('a send another pass already claimed is skipped, not doubled', async () => {
    h.db.emailPrefs.updateMany.mockResolvedValue({ count: 0 })
    const s = await runWeekly({ now: NOW, mode: 'live' })
    expect(s.sent).toBe(0)
    expect(s.skipped.recent).toBe(2)
    expect(h.send).not.toHaveBeenCalled()
  })

  it('no new jobs means no email', async () => {
    h.db.jobMatch.findMany.mockResolvedValue([])
    const s = await runWeekly({ now: NOW, mode: 'live' })
    expect(s.skipped.no_new_jobs).toBe(2)
    expect(h.send).not.toHaveBeenCalled()
  })

  it('respects unsubscribes and inactivity', async () => {
    h.db.emailPrefs.findUnique.mockImplementation(async ({ where }: { where: { userId: string } }) =>
      where.userId === 'u1' ? { weekly: false, lastWeeklyAt: null, unsubscribedAt: NOW } : null
    )
    h.db.event.groupBy.mockResolvedValue([{ userId: 'u1', _max: { createdAt: NOW } }])
    const s = await runWeekly({ now: NOW, mode: 'live' })
    expect(s.skipped).toMatchObject({ unsubscribed: 1, inactive: 1 })
    expect(h.send).not.toHaveBeenCalled()
  })

  it('the weekly run leaves daily people to the daily brief, and the other way round', async () => {
    h.db.emailPrefs.findUnique.mockImplementation(async ({ where, select }: { where: { userId: string }; select: Record<string, boolean> }) =>
      where.userId === 'u1' ? (select.daily ? { daily: true } : { weekly: true, lastWeeklyAt: null, unsubscribedAt: null }) : null
    )
    const weekly = await runWeekly({ now: NOW, mode: 'live' })
    expect(weekly).toMatchObject({ sent: 1, skipped: { gets_daily: 1 } })
    vi.clearAllMocks()
    const daily = await runWeekly({ now: NOW, mode: 'live', cadence: 'daily' })
    expect(daily).toMatchObject({ cadence: 'daily', sent: 1, skipped: { gets_weekly: 1 } })
    const mail = (h.send.mock.calls[0] as unknown as [{ to: string; subject: string; tag: string }])[0]
    expect(mail).toMatchObject({ to: 'jake@example.com', subject: 'Your measurements today: 2 new jobs that fit', tag: 'daily' })
    // Being on the other run is not worth an event row.
    expect(h.track).not.toHaveBeenCalledWith('weekly_email', expect.objectContaining({ reason: 'gets_weekly' }), expect.anything())
  })

  it('before the daily SQL is pasted, everyone stays weekly', async () => {
    h.db.emailPrefs.findUnique.mockImplementation(async ({ select }: { select: Record<string, boolean> }) => {
      if (select.daily) throw new Error('column "daily" does not exist')
      return { weekly: true, lastWeeklyAt: null, unsubscribedAt: null }
    })
    expect((await runWeekly({ now: NOW, mode: 'live' })).sent).toBe(2)
    vi.clearAllMocks()
    expect((await runWeekly({ now: NOW, mode: 'live', cadence: 'daily' })).sent).toBe(0)
  })

  it('stops starting people near the deadline', async () => {
    const s = await runWeekly({ now: NOW, mode: 'live', deadline: Date.now() + 10_000 })
    expect(s.outOfTime).toBe(true)
    expect(s.considered).toBe(0)
  })
})
