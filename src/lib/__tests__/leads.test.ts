// POST /api/leads, the lead unsubscribe route, the card's show/hide rules and the emails.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  const s = { leads: [] as any[], events: [] as { name: string; props: any }[], skillGaps: [] as any[] }
  let n = 0
  const find = (where: any) =>
    where.id ? s.leads.find((l) => l.id === where.id) : s.leads.find((l) => l.email === where.email_source.email && l.source === where.email_source.source)
  const prisma: any = {
    lead: {
      findUnique: vi.fn(async ({ where }: any) => find(where) ?? null),
      create: vi.fn(async ({ data }: any) => {
        if (s.leads.some((l) => l.email === data.email && l.source === data.source)) throw Object.assign(new Error('unique'), { code: 'P2002' })
        const row = { id: `lead${++n}`, unsubscribedAt: null, createdAt: new Date(), ...data }
        s.leads.push(row)
        return row
      }),
      update: vi.fn(async ({ where, data }: any) => Object.assign(find(where), data)),
    },
    skillGap: {
      findMany: vi.fn(async ({ where }: any) => s.skillGaps.filter((g) => where.key.in.includes(g.key))),
      createMany: vi.fn(async () => ({ count: 0 })),
    },
  }
  return { s, prisma }
})

vi.mock('@/lib/prisma', () => ({ prisma: h.prisma }))
vi.mock('@/lib/track', () => ({ track: vi.fn(async (name: string, props: any) => void h.s.events.push({ name, props })) }))

import { POST } from '@/app/api/leads/route'
import { POST as UNSUB } from '@/app/api/leads/unsubscribe/route'
import { leadUnsubscribeToken, unsubscribeToken, readUnsubscribeToken, readLeadUnsubscribeToken } from '@/lib/email/unsubscribe'
import { encodeSource } from '@/lib/signup-source'
import { readLeadMemory, showLeadCard, writeLeadMemory, LEAD_COPY, LEAD_FINE_PRINT } from '@/lib/leads-shared'
import { leadContext } from '@/lib/leads'
import { leadRows } from '@/lib/admin-analytics'
import { leadCheckEmail, leadFitEmail } from '@/lib/email/templates'

let ipN = 0
function req(body: unknown, opts: { ip?: string; cookie?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': opts.ip ?? `10.0.0.${++ipN}` }
  if (opts.cookie) headers.cookie = opts.cookie
  return new NextRequest('https://rework.careers/api/leads', { method: 'POST', headers, body: JSON.stringify(body) })
}

const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 're_1' }), { status: 200 }))

beforeEach(() => {
  h.s.leads = []
  h.s.events = []
  h.s.skillGaps = []
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('NEXTAUTH_SECRET', 'test-secret')
  vi.stubEnv('EMAIL_LEADS', '')
  vi.stubEnv('RESEND_API_KEY', '')
  vi.stubEnv('EMAIL_MAILING_ADDRESS', '')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('POST /api/leads', () => {
  it('stores a valid email, lowercased, with the ref tag and landing path', async () => {
    const cookie = `rw_src=${encodeSource({ s: 'reddit', p: '/check', t: true })}`
    const res = await POST(req({ email: '  Pat@Example.COM ', source: 'check' }, { cookie }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(h.s.leads).toHaveLength(1)
    expect(h.s.leads[0]).toMatchObject({ email: 'pat@example.com', source: 'check', ref: 'reddit', landing: '/check', consentVersion: 'lead-2026-11-25' })
    expect(h.s.events).toEqual([{ name: 'lead_captured', props: { source: 'check', ref: 'reddit' } }])
  })

  it('uses "direct" without a source cookie', async () => {
    await POST(req({ email: 'a@b.co', source: 'fit' }))
    expect(h.s.leads[0]).toMatchObject({ ref: 'direct', landing: null })
  })

  it('never stores the job, resume or missing keywords with the lead', async () => {
    await POST(req({ email: 'a@b.co', source: 'fit', missing: ['SQL', 'Tableau'], job: 'https://jobs.example.com/1', resumeText: 'secret' }))
    expect(Object.keys(h.s.leads[0]).sort()).toEqual(['consentVersion', 'createdAt', 'email', 'id', 'landing', 'ref', 'source', 'unsubscribedAt'])
  })

  it('rejects an invalid email or source', async () => {
    for (const body of [{ email: 'not-an-email', source: 'check' }, { email: 'a@b.co', source: 'tailor' }, { source: 'check' }, null]) {
      const res = await POST(req(body))
      expect(res.status).toBe(400)
      expect((await res.json()).ok).toBe(false)
    }
    expect(h.s.leads).toHaveLength(0)
  })

  it('answers the same for a duplicate and keeps one row, one event', async () => {
    const a = await POST(req({ email: 'a@b.co', source: 'check' }))
    const b = await POST(req({ email: 'A@B.co', source: 'check' }))
    expect(await a.json()).toEqual(await b.json())
    expect(h.s.leads).toHaveLength(1)
    expect(h.s.events.filter((e) => e.name === 'lead_captured')).toHaveLength(1)
  })

  it('keeps one lead per tool: the same email on /check and /fit is two rows', async () => {
    await POST(req({ email: 'a@b.co', source: 'check' }))
    await POST(req({ email: 'a@b.co', source: 'fit' }))
    expect(h.s.leads.map((l) => l.source)).toEqual(['check', 'fit'])
  })

  it('rate limits by IP', async () => {
    const codes: number[] = []
    for (let i = 0; i < 11; i++) codes.push((await POST(req({ email: `p${i}@b.co`, source: 'check' }, { ip: '9.9.9.9' }))).status)
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true)
    expect(codes[10]).toBe(429)
  })

  it('honeypot: answers ok and stores nothing', async () => {
    const res = await POST(req({ email: 'bot@spam.co', source: 'check', website: 'http://spam' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(h.s.leads).toHaveLength(0)
    expect(h.s.events).toHaveLength(0)
  })

  it('sends nothing while EMAIL_LEADS is off (the default)', async () => {
    vi.stubEnv('RESEND_API_KEY', 'k')
    vi.stubEnv('EMAIL_MAILING_ADDRESS', 'PO Box 1')
    await POST(req({ email: 'a@b.co', source: 'check' }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('dry run tracks but sends nothing', async () => {
    vi.stubEnv('EMAIL_LEADS', 'dry')
    await POST(req({ email: 'a@b.co', source: 'check' }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(h.s.events.find((e) => e.name === 'lead_email')?.props).toMatchObject({ source: 'check', status: 'dry' })
  })

  it('on: sends one email with a one-click unsubscribe, and not again for a duplicate', async () => {
    vi.stubEnv('EMAIL_LEADS', 'on')
    vi.stubEnv('RESEND_API_KEY', 'k')
    vi.stubEnv('EMAIL_MAILING_ADDRESS', 'PO Box 1')
    h.s.skillGaps = [{ key: 'sql', plan: { skill: 'SQL', closeable: true, time: '4 to 8 weeks', learn: 'Joins.', build: 'Ten queries.', addAs: 'x', query: 'sql' } }]
    await POST(req({ email: 'a@b.co', source: 'fit', missing: ['SQL', 'Tableau'] }))
    await POST(req({ email: 'a@b.co', source: 'fit', missing: ['SQL'] }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const sent = JSON.parse((fetchMock.mock.calls[0] as any)[1].body)
    expect(sent.to).toEqual(['a@b.co'])
    expect(sent.subject).toBe('Your 2 missing keywords')
    expect(sent.text).toContain('SQL, Tableau')
    expect(sent.text).toContain('Ten queries.')
    expect(sent.headers['List-Unsubscribe']).toContain('/api/leads/unsubscribe?t=')
    expect(h.s.events.find((e) => e.name === 'lead_email')?.props).toMatchObject({ status: 'sent', resendId: 're_1' })
  })
})

describe('POST /api/leads/unsubscribe', () => {
  const unsubReq = (t: string) => new NextRequest(`https://rework.careers/api/leads/unsubscribe?t=${encodeURIComponent(t)}`, { method: 'POST' })

  it('sets unsubscribedAt from a valid token', async () => {
    await POST(req({ email: 'a@b.co', source: 'check' }))
    const id = h.s.leads[0].id
    const res = await UNSUB(unsubReq(leadUnsubscribeToken(id)))
    expect(res.status).toBe(200)
    expect(h.s.leads[0].unsubscribedAt).toBeInstanceOf(Date)
  })

  it('refuses a forged token and a user unsubscribe token', async () => {
    await POST(req({ email: 'a@b.co', source: 'check' }))
    const id = h.s.leads[0].id
    expect((await UNSUB(unsubReq(`${Buffer.from(id).toString('base64url')}.nope`))).status).toBe(400)
    expect((await UNSUB(unsubReq(unsubscribeToken(id)))).status).toBe(400)
    expect(h.s.leads[0].unsubscribedAt).toBeNull()
  })

  it('opting in again after unsubscribing clears it', async () => {
    await POST(req({ email: 'a@b.co', source: 'check' }))
    await UNSUB(unsubReq(leadUnsubscribeToken(h.s.leads[0].id)))
    await POST(req({ email: 'a@b.co', source: 'check' }))
    expect(h.s.leads).toHaveLength(1)
    expect(h.s.leads[0].unsubscribedAt).toBeNull()
  })
})

describe('unsubscribe token scopes', () => {
  it('a lead token and a user token are not interchangeable', () => {
    expect(readLeadUnsubscribeToken(leadUnsubscribeToken('abc', 'k'), 'k')).toBe('abc')
    expect(readUnsubscribeToken(leadUnsubscribeToken('abc', 'k'), 'k')).toBeNull()
    expect(readLeadUnsubscribeToken(unsubscribeToken('abc', 'k'), 'k')).toBeNull()
  })
})

describe('lead card show/hide', () => {
  const mem = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
  }
  const broken = {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('blocked')
    },
  }

  it('never shows before a result', () => {
    expect(showLeadCard({ hasResult: false, memory: null })).toBe(false)
    expect(showLeadCard({ hasResult: false, memory: null, justSent: true })).toBe(false)
  })

  it('shows under a result until dismissed or sent', () => {
    expect(showLeadCard({ hasResult: true, memory: null })).toBe(true)
    expect(showLeadCard({ hasResult: true, memory: 'dismissed' })).toBe(false)
    expect(showLeadCard({ hasResult: true, memory: 'sent' })).toBe(false)
    expect(showLeadCard({ hasResult: true, memory: 'sent', justSent: true })).toBe(true)
  })

  it('remembers per tool, per browser', () => {
    const s = mem()
    writeLeadMemory('check', 'dismissed', s)
    expect(readLeadMemory('check', s)).toBe('dismissed')
    expect(readLeadMemory('fit', s)).toBeNull()
  })

  it('survives storage that throws or is missing', () => {
    expect(() => writeLeadMemory('fit', 'sent', broken)).not.toThrow()
    expect(readLeadMemory('fit', broken)).toBeNull()
    expect(readLeadMemory('fit', null)).toBeNull()
  })

  it('ignores junk in storage', () => {
    const s = mem()
    s.setItem('rw_lead_check', 'yes')
    expect(readLeadMemory('check', s)).toBeNull()
  })
})

describe('copy and content', () => {
  const footer = { siteUrl: 'https://rework.careers', unsubscribeUrl: 'https://rework.careers/unsubscribe/lead?t=x', settingsUrl: '', mailingAddress: 'PO Box 1', why: 'Because.' }

  it('has no em-dashes and the promised lines', () => {
    const all = [LEAD_COPY.check.prompt, LEAD_COPY.fit.prompt, LEAD_FINE_PRINT, leadCheckEmail({ checkUrl: 'u', signupUrl: 's' }, footer).text, leadFitEmail({ missing: ['SQL'], tips: [], fitUrl: 'u', signupUrl: 's' }, footer).text].join('\n')
    expect(all).not.toContain('—')
    expect(LEAD_FINE_PRINT).toBe('No spam. One-click unsubscribe.')
  })

  it('lead emails have an unsubscribe link and no settings link', () => {
    const c = leadCheckEmail({ checkUrl: 'u', signupUrl: 's' }, footer)
    expect(c.html).toContain('/unsubscribe/lead?t=x')
    expect(c.html).not.toContain('Email settings')
    expect(c.text).toContain('Unsubscribe: https://rework.careers/unsubscribe/lead?t=x')
  })

  it('leadContext falls back to direct for a bad cookie', () => {
    expect(leadContext('%%%')).toEqual({ ref: 'direct', landing: null })
  })
})

describe('leadRows', () => {
  it('joins window counts onto all-time rows, biggest first', () => {
    const rows = leadRows(
      [
        { source: 'check', ref: 'direct', n: 2, unsub: 0 },
        { source: 'fit', ref: 'reddit', n: 5, unsub: 1 },
      ],
      [{ source: 'fit', ref: 'reddit', n: 3 }]
    )
    expect(rows).toEqual([
      { source: 'fit', ref: 'reddit', leads: 5, inWindow: 3, unsubscribed: 1 },
      { source: 'check', ref: 'direct', leads: 2, inWindow: 0, unsubscribed: 0 },
    ])
  })
})
