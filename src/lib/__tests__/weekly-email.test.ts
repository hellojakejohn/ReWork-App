import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readUnsubscribeToken, unsubscribeToken } from '@/lib/email/unsubscribe'
import { firstName, pickWeeklyJobs, sendCutoff, weeklySince, weeklySkipReason, type CandidateMatch } from '@/lib/email/weekly-rules'
import { esc, weeklyEmail, weeklySubject, welcomeEmail, type Footer, type WeeklyJob } from '@/lib/email/templates'
import { sendEmail } from '@/lib/email/send'
import { sendBlocker, weeklyMode } from '@/lib/email/config'

const KEY = 'test-secret'
const NOW = new Date('2026-11-23T13:00:00Z')
const DAY = 86_400_000
const ago = (days: number) => new Date(NOW.getTime() - days * DAY)

describe('unsubscribe tokens', () => {
  it('round-trips a user id', () => {
    const t = unsubscribeToken('cm123abc', KEY)
    expect(readUnsubscribeToken(t, KEY)).toBe('cm123abc')
  })
  it('rejects forged, swapped and malformed tokens', () => {
    const t = unsubscribeToken('cm123abc', KEY)
    expect(readUnsubscribeToken(t, 'other-secret')).toBeNull()
    const [, sig] = t.split('.')
    expect(readUnsubscribeToken(`${Buffer.from('someone-else').toString('base64url')}.${sig}`, KEY)).toBeNull()
    for (const bad of ['', 'abc', '.', 'a.', '.b', null, undefined, 'x'.repeat(300)]) expect(readUnsubscribeToken(bad, KEY)).toBeNull()
  })
})

describe('who gets the weekly email', () => {
  const on = { weekly: true, lastWeeklyAt: null, unsubscribedAt: null }
  it('sends to active people with it on who had none this week', () => {
    expect(weeklySkipReason({ email: 'a@b.c', prefs: on, lastActiveAt: ago(3) }, NOW)).toBeNull()
    expect(weeklySkipReason({ email: 'a@b.c', prefs: { ...on, lastWeeklyAt: ago(7) }, lastActiveAt: ago(3) }, NOW)).toBeNull()
  })
  it('skips with a reason', () => {
    expect(weeklySkipReason({ email: null, prefs: on, lastActiveAt: ago(1) }, NOW)).toBe('no_email')
    expect(weeklySkipReason({ email: 'a@b.c', prefs: null, lastActiveAt: ago(1) }, NOW)).toBe('prefs_unreadable')
    expect(weeklySkipReason({ email: 'a@b.c', prefs: { ...on, weekly: false }, lastActiveAt: ago(1) }, NOW)).toBe('off')
    expect(weeklySkipReason({ email: 'a@b.c', prefs: { ...on, weekly: true, unsubscribedAt: ago(2) }, lastActiveAt: ago(1) }, NOW)).toBe('unsubscribed')
    expect(weeklySkipReason({ email: 'a@b.c', prefs: on, lastActiveAt: ago(91) }, NOW)).toBe('inactive')
    expect(weeklySkipReason({ email: 'a@b.c', prefs: on, lastActiveAt: null }, NOW)).toBe('inactive')
    expect(weeklySkipReason({ email: 'a@b.c', prefs: { ...on, lastWeeklyAt: ago(0.1) }, lastActiveAt: ago(1) }, NOW)).toBe('recent')
  })
  it('looks back to the last email, or a week', () => {
    expect(weeklySince(ago(9), NOW)).toEqual(ago(9))
    expect(weeklySince(null, NOW)).toEqual(ago(7))
    expect(sendCutoff(NOW)).toEqual(ago(6))
  })
  it('reads a first name, or none', () => {
    expect(firstName('Jakob Johnson')).toBe('Jakob')
    expect(firstName('  ')).toBeNull()
    expect(firstName(null)).toBeNull()
  })
})

describe('which jobs go in', () => {
  const m = (id: string, over: Partial<Omit<CandidateMatch, 'job'>> & { job?: Partial<CandidateMatch['job']> } = {}): CandidateMatch => ({
    id,
    rank: 50,
    score: 50,
    related: [],
    dismissedAt: null,
    applicationId: null,
    ...over,
    job: { title: `Role ${id}`, company: 'Co', firstSeenAt: ago(2), closedAt: null, ...over.job },
  })
  it('keeps only new, open, untouched jobs with some fit, best first, five at most', () => {
    const picked = pickWeeklyJobs(
      [
        m('old', { job: { firstSeenAt: ago(10) } }),
        m('closed', { job: { closedAt: ago(1) } }),
        m('dismissed', { dismissedAt: ago(1) }),
        m('tailored', { applicationId: 'app1' }),
        m('zero', { score: 0, rank: 99 }),
        m('related', { score: 0, related: ['SQL'], rank: 10 }),
        ...['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => m(id, { rank: 90 - i })),
      ],
      ago(7)
    )
    expect(picked.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
  it('drops repeats of the same role at the same company', () => {
    const picked = pickWeeklyJobs([m('x', { rank: 80, job: { title: 'Analyst' } }), m('y', { rank: 70, job: { title: ' analyst ' } })], ago(7))
    expect(picked.map((p) => p.id)).toEqual(['x'])
  })
})

const FOOTER: Footer = {
  siteUrl: 'https://rework.careers',
  unsubscribeUrl: 'https://rework.careers/unsubscribe?t=abc',
  settingsUrl: 'https://rework.careers/dashboard?settings=email',
  mailingAddress: 'PO Box 1, Saint Paul, MN 55101',
  why: 'You get this because weekly job emails are on.',
}
const JOB: WeeklyJob = {
  title: 'Ops <Coordinator>',
  company: 'Acme & Co',
  location: 'Saint Paul, MN',
  remote: false,
  payLabel: '$60k',
  score: 62,
  reach: 74,
  present: ['Scheduling', 'Inventory'],
  tailorUrl: 'https://rework.careers/dashboard?match=m1',
}

describe('the emails', () => {
  it('weekly: subject, escaped jobs, the tape, lift line, follow-ups, footer', () => {
    const e = weeklyEmail({ firstName: 'Jake', jobs: [JOB, { ...JOB, title: 'Second', reach: 63 }], checked: 33_412, followUpsDue: 2, trackerUrl: 'https://t', dashboardUrl: 'https://d' }, FOOTER)
    expect(e.subject).toBe('Your measurements this week: 2 new jobs that fit')
    expect(e.html).toContain('Ops &lt;Coordinator&gt;')
    expect(e.html).toContain('Acme &amp; Co')
    expect(e.html).not.toContain('<Coordinator>')
    expect(e.html).toContain('62%')
    expect(e.html).toContain('Tailoring can lift this to 74%.')
    expect(e.html.match(/Tailoring can lift/g)).toHaveLength(1) // 63 is under +5
    expect(e.html).toContain('33,000 open jobs')
    expect(e.html).toContain('2 follow-ups due.')
    expect(e.html).toContain(FOOTER.unsubscribeUrl)
    expect(e.html).toContain(esc(FOOTER.mailingAddress))
    expect(e.text).toContain('Tailor for this job: https://rework.careers/dashboard?match=m1')
    expect(e.text).toContain(FOOTER.mailingAddress)
    expect(e.preheader).toBe('Ops <Coordinator> at Acme & Co, 62% match, and 1 more.')
  })
  it('weekly: one job reads right', () => {
    expect(weeklySubject(1)).toBe('Your measurements this week: 1 new job that fit')
    const e = weeklyEmail({ firstName: null, jobs: [JOB], checked: 900, followUpsDue: 0, trackerUrl: 't', dashboardUrl: 'd' }, FOOTER)
    expect(e.preheader).toBe('Ops <Coordinator> at Acme & Co, 62% match.')
    expect(e.html).not.toContain('follow-up')
    expect(e.html).toContain('Hi,')
  })
  it('welcome: three steps, free tailors, footer', () => {
    const e = welcomeEmail({ firstName: 'Jake', dashboardUrl: 'https://d', freeTailors: 3 }, FOOTER)
    expect(e.subject).toBe('Welcome to ReWork')
    expect(e.html).toContain('Free covers 3 tailors a month.')
    expect(e.html).toContain(FOOTER.unsubscribeUrl)
    expect(e.text).toContain('Start with your resume: https://d')
  })
  it('labels Adzuna ads with their linked logo text, and only those', () => {
    const e = weeklyEmail({ firstName: 'Jake', jobs: [JOB, { ...JOB, title: 'Warehouse Lead', adzuna: true }], checked: 100, followUpsDue: 0, trackerUrl: 'https://t', dashboardUrl: 'https://d' }, FOOTER)
    expect(e.html.match(/href="https:\/\/www\.adzuna\.com"/g)).toHaveLength(1)
    expect(e.html).toContain('Jobs by Adzuna')
    expect(e.html).toContain('min-width:116px')
  })

  it('never uses em-dashes', () => {
    const all = [weeklyEmail({ firstName: 'J', jobs: [JOB], checked: 1, followUpsDue: 1, trackerUrl: 't', dashboardUrl: 'd' }, FOOTER), welcomeEmail({ firstName: 'J', dashboardUrl: 'd', freeTailors: 3 }, FOOTER)]
    for (const e of all) expect(`${e.subject}${e.html}${e.text}${e.preheader}`).not.toMatch(/—/)
  })
})

describe('sending', () => {
  const KEYS = ['RESEND_API_KEY', 'EMAIL_MAILING_ADDRESS', 'EMAIL_WEEKLY', 'EMAIL_FROM']
  let saved: Record<string, string | undefined> = {}
  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))
    for (const k of KEYS) delete process.env[k]
  })
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it('refuses without a key or a mailing address, and never calls Resend', async () => {
    const fetchFn = vi.fn()
    expect(sendBlocker()).toMatch(/RESEND_API_KEY/)
    process.env.RESEND_API_KEY = 're_test'
    expect(sendBlocker()).toMatch(/EMAIL_MAILING_ADDRESS/)
    const res = await sendEmail({ to: 'a@b.c', subject: 's', html: 'h', text: 't' }, fetchFn as never)
    expect(res.ok).toBe(false)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('posts to Resend with one-click unsubscribe headers', async () => {
    process.env.RESEND_API_KEY = 're_test'
    process.env.EMAIL_MAILING_ADDRESS = 'PO Box 1'
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ id: 'em_1' }), { status: 200 }))
    const res = await sendEmail({ to: 'a@b.c', subject: 's', html: 'h', text: 't', unsubscribeUrl: 'https://u', tag: 'weekly' }, fetchFn as never)
    expect(res).toEqual({ ok: true, id: 'em_1' })
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    const body = JSON.parse(String(init.body))
    expect(body.to).toEqual(['a@b.c'])
    expect(body.from).toBe('ReWork <hello@send.rework.careers>')
    expect(body.headers).toEqual({ 'List-Unsubscribe': '<https://u>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' })
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer re_test')
  })

  it('reports a Resend error without throwing', async () => {
    process.env.RESEND_API_KEY = 're_test'
    process.env.EMAIL_MAILING_ADDRESS = 'PO Box 1'
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ message: 'domain not verified' }), { status: 403 }))
    expect(await sendEmail({ to: 'a@b.c', subject: 's', html: 'h', text: 't' }, fetchFn as never)).toEqual({ ok: false, error: 'Resend 403: domain not verified' })
  })

  it('weekly mode is off unless set to a known value', () => {
    expect(weeklyMode()).toBe('off')
    process.env.EMAIL_WEEKLY = 'LIVE'
    expect(weeklyMode()).toBe('live')
    process.env.EMAIL_WEEKLY = 'yes please'
    expect(weeklyMode()).toBe('off')
  })
})
