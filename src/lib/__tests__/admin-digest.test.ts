// The daily admin digest: alerts, the email, and the run with the DB and Resend faked.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  db: {
    event: { groupBy: vi.fn(), findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
    entitlement: { findMany: vi.fn() },
    job: { count: vi.fn() },
    $queryRaw: vi.fn(),
  },
  track: vi.fn(async () => {}),
}))
vi.mock('@/lib/prisma', () => ({ prisma: h.db }))
vi.mock('@/lib/track', () => ({ track: h.track }))

import { digestAlerts, digestEmail, digestMode, runAdminDigest, type DigestData } from '@/lib/email/admin-digest'

const NOW = new Date('2026-11-23T14:45:00Z')
const base: DigestData = {
  day: '2026-11-22',
  signups: 2,
  signupsBySource: [{ source: 'x', n: 2 }],
  parsed: 3,
  tailored: 1,
  coverLetters: 0,
  matchRuns: 1,
  checkouts: 0,
  paid: 0,
  publicFit: 4,
  publicCheck: 1,
  errors: 0,
  topErrors: [],
  aiUsd: 0.42,
  proActive: 0,
  openJobs: 33_000,
  pull: { at: '2026-11-23T12:35:00Z', ok: 175, boards: 177, failed: 2, added: 900, closed: 300, usajobs: 9000, failedBoards: 'greenhouse:foo: HTTP 404' },
  dbMb: 160,
  signups7d: 5,
}

describe('admin digest content', () => {
  it('is quiet on a normal day', () => {
    expect(digestAlerts(base, NOW)).toEqual([])
    const mail = digestEmail(base, NOW)
    expect(mail.subject).toBe('ReWork 2026-11-22: 2 signups, 1 tailor')
    expect(mail.text).toContain('Nothing needs a look.')
    expect(mail.text).toContain('Signups: 2 (x 2); 5 in the last 7 days')
    expect(mail.text).toContain('9,000 federal')
    expect(mail.text).toContain('Failed boards: greenhouse:foo: HTTP 404')
    expect(mail.text).not.toMatch(/—/)
  })

  it('flags a stale pull, many failed boards, errors, spend and a big database', () => {
    const bad = { ...base, paid: 1, errors: 12, aiUsd: 11, dbMb: 420, pull: { ...base.pull!, at: '2026-11-21T12:30:00Z', failed: 9 } }
    const alerts = digestAlerts(bad, NOW)
    expect(alerts).toHaveLength(5)
    expect(alerts[0]).toContain('50 hours ago')
    expect(digestEmail(bad, NOW).subject).toBe('ReWork 2026-11-22: 2 signups, 1 tailor, 1 paid (5 to check)')
    expect(digestAlerts({ ...base, pull: null }, NOW)).toEqual(['No job pull on record.'])
  })

  it('escapes anything odd in the HTML', () => {
    expect(digestEmail({ ...base, signupsBySource: [{ source: '<b>', n: 1 }] }, NOW).html).toContain('&lt;b&gt;')
  })

  it('is off unless EMAIL_ADMIN_DIGEST says dry or on', () => {
    delete process.env.EMAIL_ADMIN_DIGEST
    expect(digestMode()).toBe('off')
    process.env.EMAIL_ADMIN_DIGEST = 'ON'
    expect(digestMode()).toBe('on')
    process.env.EMAIL_ADMIN_DIGEST = 'yes'
    expect(digestMode()).toBe('off')
    delete process.env.EMAIL_ADMIN_DIGEST
  })
})

describe('runAdminDigest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ADMIN_EMAILS
    h.db.event.groupBy.mockResolvedValue([{ name: 'tailored', _count: { _all: 3 } }])
    h.db.event.findMany.mockResolvedValue([])
    h.db.event.count.mockResolvedValue(0)
    h.db.event.findFirst.mockResolvedValue(null)
    h.db.entitlement.findMany.mockResolvedValue([])
    h.db.job.count.mockResolvedValue(100)
    h.db.$queryRaw.mockResolvedValue([])
  })

  it('does nothing when off', async () => {
    expect(await runAdminDigest({ now: NOW, mode: 'off' })).toEqual({ mode: 'off', status: 'off' })
    expect(h.db.event.groupBy).not.toHaveBeenCalled()
  })

  it('dry run logs and sends nothing', async () => {
    const send = vi.fn()
    expect((await runAdminDigest({ now: NOW, mode: 'dry', send })).status).toBe('dry')
    expect(send).not.toHaveBeenCalled()
    expect(h.track).toHaveBeenCalledWith('admin_digest', expect.objectContaining({ status: 'dry', tailored: 3 }))
  })

  it('sends to each admin once a day', async () => {
    const send = vi.fn(async () => ({ ok: true as const, id: 'em' }))
    const r = await runAdminDigest({ now: NOW, mode: 'on', send })
    expect(r).toMatchObject({ status: 'sent', to: 2 })
    expect(send).toHaveBeenCalledTimes(2)
    // Yesterday's UTC window.
    expect(h.db.event.groupBy.mock.calls[0][0].where.createdAt.gte.toISOString()).toBe('2026-11-22T00:00:00.000Z')
    h.db.event.findFirst.mockResolvedValueOnce({ id: 'e1' })
    expect((await runAdminDigest({ now: NOW, mode: 'on', send })).status).toBe('already_sent')
  })

  it('reports a failed send', async () => {
    const send = vi.fn(async () => ({ ok: false as const, error: 'Resend 403: nope' }))
    expect(await runAdminDigest({ now: NOW, mode: 'on', send })).toMatchObject({ status: 'failed', error: 'Resend 403: nope' })
  })
})
