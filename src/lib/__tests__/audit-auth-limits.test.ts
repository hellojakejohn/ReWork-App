// Audit (launch-audit): server-side limits under direct API calls and concurrency.
//
// it.fails = a bug that exists today. Each one says the behavior we want once fixed; when
// the fix lands, the test starts "unexpectedly passing" and should become a plain it().
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  const s = {
    isPro: false,
    session: { user: { id: 'userA', email: 'a@example.com' } },
    user: {} as Record<string, any>,
    apps: [] as any[],
    events: [] as { name: string; createdAt: Date }[],
    resume: null as any,
    modelCalls: 0,
    rewriteItems: [] as any[],
  }
  const tick = () => new Promise((r) => setTimeout(r, 5))
  const matchUser = (where: Record<string, any>) =>
    Object.entries(where).every(([k, c]) => {
      if (k === 'id') return true
      const v = s.user[k]
      if (c && typeof c === 'object' && !(c instanceof Date)) {
        if (c.lt !== undefined && !(v < c.lt)) return false
        if (c.gte !== undefined && !(v >= c.gte)) return false
        if (c.gt !== undefined && !(v > c.gt)) return false
        return true
      }
      return v === c
    })
  const prisma: any = {
    user: {
      findUnique: vi.fn(async () => ({ ...s.user })),
      // One conditional UPDATE is atomic in Postgres; JS runs this body without interleaving.
      updateMany: vi.fn(async ({ where, data }: any) => {
        await tick()
        if (!matchUser(where)) return { count: 0 }
        for (const [k, v] of Object.entries<any>(data)) {
          s.user[k] = v && typeof v === 'object' && 'increment' in v ? s.user[k] + v.increment : v && typeof v === 'object' && 'decrement' in v ? s.user[k] - v.decrement : v
        }
        return { count: 1 }
      }),
    },
    resume: {
      findUnique: vi.fn(async () => s.resume),
      findFirst: vi.fn(async () => s.resume),
      update: vi.fn(async ({ data }: any) => {
        Object.assign(s.resume, data)
        return { ...s.resume }
      }),
    },
    jobApplication: {
      count: vi.fn(async () => {
        await tick() // a real round trip
        return s.apps.length
      }),
      create: vi.fn(async ({ data }: any) => {
        await tick()
        const row = { id: `app_${s.apps.length + 1}`, createdAt: new Date(), updatedAt: new Date(), status: 'DRAFT', ...data }
        s.apps.push(row)
        return row
      }),
      findFirst: vi.fn(async () => null),
    },
    event: {
      count: vi.fn(async ({ where }: any) => {
        await tick()
        return s.events.filter((e) => e.name === where.name && e.createdAt >= where.createdAt.gte).length
      }),
    },
  }
  return { s, prisma, tick }
})

vi.mock('next-auth', async (orig) => ({ ...(await orig<any>()), getServerSession: vi.fn(async () => h.s.session) }))
vi.mock('@/lib/prisma', () => ({ prisma: h.prisma }))
vi.mock('@/lib/track', () => ({
  track: vi.fn(async (name: string) => {
    h.s.events.push({ name, createdAt: new Date() })
  }),
  msSince: () => 1,
}))
vi.mock('@/lib/entitlements', () => ({ getAccess: vi.fn(async () => ({ isPro: h.s.isPro })) }))
vi.mock('@/lib/ai-cap', () => ({
  getAIBudget: vi.fn(async () => ({ state: { band: 'normal', period: { kind: 'free', resetAt: new Date() } }, scope: {}, settle: async () => {} })),
  aiPausedCheck: vi.fn(async () => null),
}))
// Vercel runs many instances; the in-memory speed bump doesn't see requests on the others.
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }), rateLimitResponseBody: () => ({}) }))
vi.mock('@/lib/tailor', async (orig) => ({
  ...(await orig<any>()),
  callTailorModel: vi.fn(async () => {
    h.s.modelCalls++
    await h.tick()
    return { model: 'm', output: { roles: [], projects: [], targetKeywords: [] } }
  }),
}))
vi.mock('@/lib/fact-guard', () => ({ factGuard: vi.fn(() => ({ cleaned: { summary: '', roles: [], projects: [], skills: [], targetKeywords: [] }, warnings: [] })) }))
vi.mock('@/lib/keyword-coverage', () => ({ coverageReport: vi.fn(() => ({ master: { score: 0, present: [], missing: [] }, tailored: { score: 0, present: [], missing: [] } })) }))
vi.mock('@/lib/tailor-changes', () => ({ buildChanges: vi.fn(() => []), applyChangeDecision: vi.fn((x: any) => x) }))
vi.mock('@/lib/evidence', async (orig) => ({
  ...(await orig<any>()),
  rewriteWithEvidence: vi.fn(async (items: any[]) => {
    h.s.rewriteItems = items
    return []
  }),
}))

import { POST as tailorPOST } from '@/app/api/resumes/[id]/tailor/route'
import { POST as trackerPOST } from '@/app/api/tracker/route'
import { POST as rewritePOST } from '@/app/api/resumes/[id]/evidence/rewrite/route'
import { PATCH as resumePATCH } from '@/app/api/resumes/[id]/route'
import { DAILY_CEILINGS, FREE_TAILORS_PER_MONTH, FREE_TRACKER_APPLICATIONS } from '@/lib/plans'

const json = (url: string, method: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const tailorBody = { jobTitle: 'Ops', company: 'Acme', description: 'Run operations.' }

beforeEach(() => {
  const now = new Date()
  h.s.isPro = false
  h.s.apps = []
  h.s.events = []
  h.s.modelCalls = 0
  h.s.rewriteItems = []
  h.s.user = { id: 'userA', monthlyTailors: 0, tailorsResetAt: now, monthlyCoverLetters: 0, coverLettersResetAt: now }
  h.s.resume = {
    id: 'resA', userId: 'userA', isActive: true, evidence: null, title: 'A', createdAt: now, updatedAt: now, hiddenAt: null,
    contactInfo: { fullName: 'A Person' }, professionalSummary: { summary: '' },
    workExperience: [{ id: 'role1', jobTitle: 'Manager', company: 'Shop', achievements: ['Managed the team'] }],
    education: [], skills: [], projects: [], additionalSections: {}, originalContent: {},
  }
})

describe('monthly tailor quota (regression guard)', () => {
  it(`FREE: ${FREE_TAILORS_PER_MONTH * 4} parallel tailors -> exactly ${FREE_TAILORS_PER_MONTH} model calls`, async () => {
    const res = await Promise.all(Array.from({ length: FREE_TAILORS_PER_MONTH * 4 }, () => tailorPOST(json('/x', 'POST', tailorBody), ctx('resA'))))
    expect(res.filter((r) => r.status === 200)).toHaveLength(FREE_TAILORS_PER_MONTH)
    expect(res.filter((r) => r.status === 402)).toHaveLength(FREE_TAILORS_PER_MONTH * 3)
    expect(h.s.modelCalls).toBe(FREE_TAILORS_PER_MONTH)
    expect(h.s.user.monthlyTailors).toBe(FREE_TAILORS_PER_MONTH)
  })
})

describe('daily ceiling is check-then-act', () => {
  // checkDailyCeiling counts today's `tailored` events, which are written after the model
  // call. A burst all reads the same count, so Pro (no monthly cap) blows through it.
  it.fails(`Pro: ${DAILY_CEILINGS.tailor + 10} parallel tailors should be capped at ${DAILY_CEILINGS.tailor} model calls`, async () => {
    h.s.isPro = true
    const n = DAILY_CEILINGS.tailor + 10
    await Promise.all(Array.from({ length: n }, () => tailorPOST(json('/x', 'POST', tailorBody), ctx('resA'))))
    expect(h.s.modelCalls).toBeLessThanOrEqual(DAILY_CEILINGS.tailor)
  })
})

describe('tracker limit is check-then-act', () => {
  it.fails(`FREE at ${FREE_TRACKER_APPLICATIONS - 1} jobs: 5 parallel "Add a job" should end at ${FREE_TRACKER_APPLICATIONS}`, async () => {
    h.s.apps = Array.from({ length: FREE_TRACKER_APPLICATIONS - 1 }, (_, i) => ({ id: `old${i}` }))
    await Promise.all(Array.from({ length: 5 }, () => trackerPOST(json('/api/tracker', 'POST', { title: 't', company: 'c' }))))
    expect(h.s.apps.length).toBeLessThanOrEqual(FREE_TRACKER_APPLICATIONS)
  })

  it.fails(`FREE at ${FREE_TRACKER_APPLICATIONS} jobs: tailoring should not add an 11th tracked job`, async () => {
    h.s.apps = Array.from({ length: FREE_TRACKER_APPLICATIONS }, (_, i) => ({ id: `old${i}` }))
    await tailorPOST(json('/x', 'POST', tailorBody), ctx('resA'))
    expect(h.s.apps.length).toBeLessThanOrEqual(FREE_TRACKER_APPLICATIONS)
  })
})

describe('evidence rewrite trusts client-sent prompt text', () => {
  const body = (qLen: number, items = 1) => ({
    items: Array.from({ length: items }, (_, i) => ({ id: `i${i}`, entryId: 'role1', bullet: 'Managed the team', weakness: 'w'.repeat(qLen), questions: [{ id: 'q1', text: 'Q'.repeat(qLen) }] })),
    answers: Array.from({ length: items }, (_, i) => ({ itemId: `i${i}`, questionId: 'q1', answer: '12 people' })),
  })

  it('question text and weakness from the client should be clipped before the model sees them', async () => {
    h.s.isPro = true
    const res = await rewritePOST(json('/x', 'POST', body(200_000)), ctx('resA'))
    expect(res!.status).toBe(200)
    const item = h.s.rewriteItems[0]
    expect(item.questions[0].text.length).toBeLessThanOrEqual(500)
    expect(item.weakness.length).toBeLessThanOrEqual(200)
  })

  it('the number of items sent to the model should be capped (MAX_ITEMS = 8)', async () => {
    h.s.isPro = true
    await rewritePOST(json('/x', 'POST', body(10, 200)), ctx('resA'))
    expect(h.s.rewriteItems.length).toBeLessThanOrEqual(8)
  })

  it('FREE is refused (Pro gate is server side)', async () => {
    const res = await rewritePOST(json('/x', 'POST', body(10)), ctx('resA'))
    expect(res!.status).toBe(402)
  })
})

describe('master resume edit has no size limit', () => {
  // Every AI prompt (tailor, cover letter, evidence) is built from the master, so an
  // unbounded PATCH is an unbounded prompt. Pasted resumes are capped at 30k chars.
  it('PATCH /api/resumes/[id] with ~3 MB of bullets should be refused (413) or clipped', async () => {
    const resume = {
      contact: { fullName: 'A Person', headline: '', email: '', phone: '', location: '', links: [] },
      summary: '',
      experience: [{ id: 'role1', title: 'Manager', company: 'Shop', location: '', startDate: '', endDate: '', current: false, bullets: Array.from({ length: 3000 }, (_, i) => `Bullet ${i} `.padEnd(1000, 'x')) }],
      education: [], skills: [], projects: [], certifications: [], extras: [],
    }
    const res = await resumePATCH(json('/api/resumes/resA', 'PATCH', { resume }), ctx('resA'))
    const stored = JSON.stringify(h.s.resume.workExperience ?? '').length
    expect(res.status === 413 || stored <= 100_000).toBe(true)
  })
})
