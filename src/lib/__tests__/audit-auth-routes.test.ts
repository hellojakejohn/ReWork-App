// Audit (launch-audit): every API route, signed out and as user A against user B's rows.
//
// The database is an in-memory store holding user A and user B. Any write that lands on a
// row owned by B, or any response body that contains B's marker text, is an IDOR.
// Signed out, every route must answer 401 (health: 404, crons: 401, webhook: 400/503)
// without touching the database at all.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  type Row = Record<string, any>
  const state = {
    session: null as null | { user: { id: string; email: string } },
    dbTouched: [] as string[],
    violations: [] as string[],
    tables: {} as Record<string, Row[]>,
  }
  const B_SECRET = 'SECRET_OF_USER_B'
  const ownerOf = (model: string, row: Row): string | undefined => (model === 'user' ? row.id : row.userId)

  const matchValue = (v: any, cond: any): boolean => {
    if (cond === null || typeof cond !== 'object' || cond instanceof Date) return v === cond
    if ('in' in cond) return (cond.in as any[]).includes(v)
    if ('equals' in cond) return v === cond.equals
    return true // lt/gte/not etc: treated as a match (ownership keys are always plain values)
  }
  const matches = (row: Row, where: Row = {}) =>
    Object.entries(where).every(([k, c]) => (k === 'NOT' || k === 'OR' || k === 'AND' ? true : matchValue(row[k], c)))

  const model = (name: string) => {
    const rows = () => (state.tables[name] ??= [])
    const touch = (op: string) => state.dbTouched.push(`${name}.${op}`)
    const checkWrite = (op: string, targets: Row[]) => {
      for (const r of targets) {
        const owner = ownerOf(name, r)
        if (state.session && owner && owner !== state.session.user.id) state.violations.push(`${name}.${op} on row owned by ${owner}`)
      }
    }
    const applyData = (r: Row, data: Row) => {
      for (const [k, v] of Object.entries(data ?? {})) {
        if (v && typeof v === 'object' && 'increment' in v) r[k] = (r[k] ?? 0) + v.increment
        else if (v && typeof v === 'object' && 'decrement' in v) r[k] = (r[k] ?? 0) - v.decrement
        else r[k] = v
      }
    }
    return {
      findFirst: vi.fn(async (a: any = {}) => {
        touch('findFirst')
        const r = rows().find((x) => matches(x, a.where))
        if (!r) return null
        return a.include?.resume ? { ...r, resume: state.tables.resume?.find((x) => x.id === r.resumeId) ?? null } : { ...r }
      }),
      findUnique: vi.fn(async (a: any = {}) => {
        touch('findUnique')
        const r = rows().find((x) => matches(x, a.where))
        if (!r) return null
        const out: Row = { ...r }
        // Relations on the user row (account export): only rows that belong to this user.
        const rel: Record<string, string> = { resumes: 'resume', applications: 'jobApplication', entitlements: 'entitlement', feedback: 'feedback', events: 'event' }
        if (name === 'user' && a.select) {
          for (const [key, table] of Object.entries(rel)) {
            if (a.select[key]) out[key] = (state.tables[table] ?? []).filter((x) => x.userId === r.id).map((x) => ({ ...x }))
          }
        }
        return out
      }),
      findMany: vi.fn(async (a: any = {}) => {
        touch('findMany')
        return rows().filter((x) => matches(x, a.where)).map((x) => ({ ...x }))
      }),
      count: vi.fn(async (a: any = {}) => {
        touch('count')
        return rows().filter((x) => matches(x, a.where)).length
      }),
      create: vi.fn(async (a: any) => {
        touch('create')
        const r = { id: `${name}_${rows().length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...a.data }
        if (name === 'jobApplication') {
          const res = state.tables.resume?.find((x) => x.id === r.resumeId)
          if (res && state.session && res.userId !== state.session.user.id) state.violations.push(`jobApplication.create on resume owned by ${res.userId}`)
        }
        rows().push(r)
        return { ...r }
      }),
      update: vi.fn(async (a: any) => {
        touch('update')
        const r = rows().find((x) => matches(x, a.where))
        if (!r) throw new Error('P2025 not found')
        checkWrite('update', [r])
        applyData(r, a.data)
        return { ...r }
      }),
      updateMany: vi.fn(async (a: any) => {
        touch('updateMany')
        const hit = rows().filter((x) => matches(x, a.where))
        checkWrite('updateMany', hit)
        hit.forEach((r) => applyData(r, a.data))
        return { count: hit.length }
      }),
      delete: vi.fn(async (a: any) => {
        touch('delete')
        const r = rows().find((x) => matches(x, a.where))
        if (r) checkWrite('delete', [r])
        return r
      }),
      deleteMany: vi.fn(async (a: any) => {
        touch('deleteMany')
        const hit = rows().filter((x) => matches(x, a.where))
        checkWrite('deleteMany', hit)
        state.tables[name] = rows().filter((x) => !hit.includes(x))
        return { count: hit.length }
      }),
    }
  }
  const prisma: any = new Proxy(
    {
      $queryRaw: vi.fn(async () => {
        state.dbTouched.push('$queryRaw')
        return [{ spent: 0 }]
      }),
      $transaction: vi.fn(async (fn: any) => (typeof fn === 'function' ? fn(prisma) : Promise.all(fn))),
    } as Record<string, any>,
    {
      get(target, prop: string) {
        if (prop in target) return target[prop]
        if (prop === 'then') return undefined
        target[prop] = model(prop)
        return target[prop]
      },
    }
  )
  return { state, prisma, B_SECRET }
})

vi.mock('next-auth', async (orig) => ({ ...(await orig<any>()), getServerSession: vi.fn(async () => h.state.session) }))
vi.mock('next-auth/next', async (orig) => ({ ...(await orig<any>()), getServerSession: vi.fn(async () => h.state.session) }))
vi.mock('@/lib/prisma', () => ({ prisma: h.prisma }))
vi.mock('@/lib/track', () => ({ track: vi.fn(async () => {}), msSince: () => 1 }))
vi.mock('@/lib/entitlements', () => ({
  getAccess: vi.fn(async () => ({ isPro: true })),
  grantComp: vi.fn(async () => ({ isPro: true })),
  currentChainEnd: vi.fn(async () => null),
  expireEntitlements: vi.fn(async () => ({ expired: 0 })),
}))
vi.mock('@/lib/ai-cap', () => {
  const budget = { state: { band: 'normal', period: { kind: 'free', resetAt: new Date() } }, tier: 'pro', scope: {}, pausedMessage: '', settle: async () => {} }
  return {
    getAIBudget: vi.fn(async () => budget),
    aiPausedCheck: vi.fn(async () => null),
    getCapState: vi.fn(async () => budget.state),
    usageDTO: vi.fn(() => ({ percent: 0 })),
    adminCapRows: vi.fn(async () => ({})),
    setCapOverride: vi.fn(async () => {}),
  }
})
vi.mock('@/lib/daily-ceiling', () => ({ checkDailyCeiling: vi.fn(async () => ({ allowed: true, used: 0, limit: 20, message: '' })) }))
vi.mock('@/lib/storage', () => ({
  uploadToStorage: vi.fn(async () => ({ success: true })),
  generateStorageKey: (u: string) => `users/${u}/resumes/x.pdf`,
  deleteUserFiles: vi.fn(async () => ({ deleted: 0 })),
}))
vi.mock('@/lib/stripe', async (orig) => ({ ...(await orig<any>()), getStripe: () => null }))
vi.mock('@/lib/tailor', async (orig) => ({
  ...(await orig<any>()),
  callTailorModel: vi.fn(async () => ({ model: 'm', output: { roles: [], projects: [], targetKeywords: [] } })),
}))
vi.mock('@/lib/fact-guard', () => ({ factGuard: vi.fn(() => ({ cleaned: { summary: '', roles: [], projects: [], skills: [], targetKeywords: [] }, warnings: [] })) }))
vi.mock('@/lib/keyword-coverage', () => ({ coverageReport: vi.fn(() => ({ master: { score: 0, present: [], missing: [] }, tailored: { score: 0, present: [], missing: [] } })) }))
vi.mock('@/lib/tailor-changes', () => ({ buildChanges: vi.fn(() => []), applyChangeDecision: vi.fn((s: any) => s) }))
vi.mock('@/lib/cover-letter', async (orig) => ({ ...(await orig<any>()), generateCoverLetter: vi.fn(async () => ({ text: 'letter', tone: 'professional' })) }))
vi.mock('@/lib/evidence', async (orig) => ({
  ...(await orig<any>()),
  generateQuestions: vi.fn(async () => []),
  rewriteWithEvidence: vi.fn(async () => []),
}))
vi.mock('@/lib/parse-resume', async (orig) => ({
  ...(await orig<any>()),
  parseResume: vi.fn(async () => ({
    model: 'm',
    needsReview: [],
    sourceText: 'Jane Doe',
    resume: { contact: { fullName: 'Jane Doe' }, summary: '', experience: [], education: [], skills: [], projects: [], additional: [] },
  })),
}))

const A = { id: 'userA', email: 'a@example.com' }
const B = { id: 'userB', email: 'b@example.com' }

function seed() {
  const now = new Date()
  const work = (who: string) => [{ id: `role_${who}`, company: `${who} Co`, title: 'Engineer', startDate: '2020-01', endDate: '', bullets: [`Did ${who === 'B' ? h.B_SECRET : 'things'} at work`] }]
  h.state.tables = {
    user: [
      { id: A.id, email: A.email, monthlyTailors: 0, tailorsResetAt: now, monthlyCoverLetters: 0, coverLettersResetAt: now, stripeCustomerId: null },
      { id: B.id, email: B.email, monthlyTailors: 0, tailorsResetAt: now, monthlyCoverLetters: 0, coverLettersResetAt: now, stripeCustomerId: null },
    ],
    resume: [
      { id: 'resA', userId: A.id, isActive: true, title: 'A resume', contactInfo: { fullName: 'A Person' }, professionalSummary: '', workExperience: work('A'), education: [], skills: [], projects: [], additionalSections: [], evidence: null, originalContent: {}, createdAt: now, updatedAt: now, hiddenAt: null },
      { id: 'resB', userId: B.id, isActive: true, title: h.B_SECRET, contactInfo: { fullName: h.B_SECRET }, professionalSummary: h.B_SECRET, workExperience: work('B'), education: [], skills: [], projects: [], additionalSections: [], evidence: null, originalContent: {}, createdAt: now, updatedAt: now, hiddenAt: null },
    ],
    jobApplication: [
      {
        id: 'appB', userId: B.id, resumeId: 'resB', jobTitle: h.B_SECRET, company: h.B_SECRET, jobUrl: null, jobDescription: h.B_SECRET,
        status: 'OPTIMIZED', statusUpdatedAt: now, appliedAt: null, responseAt: null, notes: h.B_SECRET, followUpAt: null,
        optimizedStructured: { contactInfo: { fullName: h.B_SECRET }, workExperience: work('B') }, originalContent: { contactInfo: { fullName: h.B_SECRET } },
        suggestions: { changes: [{ id: 'chgB', status: 'pending' }] }, coverLetter: { text: h.B_SECRET, tone: 'professional' },
        createdAt: now, updatedAt: now, matchScore: 0, categoryScores: null,
      },
    ],
  }
}

const req = (url: string, method: string, body?: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

async function bodyText(res: Response) {
  return await res.text()
}

// [label, module path, method, url, body?, params id?]
type Case = [string, string, string, string, unknown?, string?]
const ROUTES: Case[] = [
  ['account ai-usage', '@/app/api/account/ai-usage/route', 'GET', '/api/account/ai-usage'],
  ['account export', '@/app/api/account/export/route', 'GET', '/api/account/export'],
  ['account delete', '@/app/api/account/route', 'DELETE', '/api/account', { confirm: 'DELETE' }],
  ['admin analytics', '@/app/api/admin/analytics/route', 'GET', '/api/admin/analytics'],
  ['admin ai-cap', '@/app/api/admin/users/[id]/ai-cap/route', 'POST', '/api/admin/users/userB/ai-cap', { capUsd: 5 }, 'userB'],
  ['admin comp', '@/app/api/admin/users/[id]/comp/route', 'POST', '/api/admin/users/userB/comp', { days: 30 }, 'userB'],
  ['admin export', '@/app/api/admin/users/export/route', 'GET', '/api/admin/users/export'],
  ['admin users', '@/app/api/admin/users/route', 'GET', '/api/admin/users'],
  ['billing access', '@/app/api/billing/access/route', 'GET', '/api/billing/access'],
  ['feedback', '@/app/api/feedback/route', 'POST', '/api/feedback', { type: 'BUG_REPORT', message: 'xxxxxxxxxxxx', pageUrl: 'https://x.test/' }],
  ['job-url', '@/app/api/job-url/parse/route', 'POST', '/api/job-url/parse', { url: 'https://example.com/job' }],
  ['resume download', '@/app/api/resumes/[id]/download/route', 'GET', '/api/resumes/resB/download', undefined, 'resB'],
  ['evidence apply', '@/app/api/resumes/[id]/evidence/apply/route', 'POST', '/api/resumes/resB/evidence/apply', { accepted: [] }, 'resB'],
  ['evidence rewrite', '@/app/api/resumes/[id]/evidence/rewrite/route', 'POST', '/api/resumes/resB/evidence/rewrite', { items: [], answers: [] }, 'resB'],
  ['evidence questions', '@/app/api/resumes/[id]/evidence/route', 'POST', '/api/resumes/resB/evidence', {}, 'resB'],
  ['resume GET', '@/app/api/resumes/[id]/route', 'GET', '/api/resumes/resB', undefined, 'resB'],
  ['resume PATCH', '@/app/api/resumes/[id]/route', 'PATCH', '/api/resumes/resB', { hidden: true }, 'resB'],
  ['resume PATCH content', '@/app/api/resumes/[id]/route', 'PATCH', '/api/resumes/resB', { resume: { contact: { fullName: 'pwned' } } }, 'resB'],
  ['resume DELETE', '@/app/api/resumes/[id]/route', 'DELETE', '/api/resumes/resB', undefined, 'resB'],
  ['tailor', '@/app/api/resumes/[id]/tailor/route', 'POST', '/api/resumes/resB/tailor', { jobTitle: 't', company: 'c', description: 'd' }, 'resB'],
  ['cover letter download', '@/app/api/resumes/applications/[id]/cover-letter/download/route', 'GET', '/api/resumes/applications/appB/cover-letter/download', undefined, 'appB'],
  ['cover letter POST', '@/app/api/resumes/applications/[id]/cover-letter/route', 'POST', '/api/resumes/applications/appB/cover-letter', { tone: 'professional' }, 'appB'],
  ['cover letter PATCH', '@/app/api/resumes/applications/[id]/cover-letter/route', 'PATCH', '/api/resumes/applications/appB/cover-letter', { text: 'pwned' }, 'appB'],
  ['application GET', '@/app/api/resumes/applications/[id]/route', 'GET', '/api/resumes/applications/appB', undefined, 'appB'],
  ['application PATCH', '@/app/api/resumes/applications/[id]/route', 'PATCH', '/api/resumes/applications/appB', { changeId: 'chgB', status: 'accepted' }, 'appB'],
  ['applications list', '@/app/api/resumes/applications/route', 'GET', '/api/resumes/applications'],
  ['parse', '@/app/api/resumes/parse/route', 'POST', '/api/resumes/parse', { text: 'Jane Doe resume', replaces: 'resB' }],
  ['resumes list', '@/app/api/resumes/route', 'GET', '/api/resumes'],
  ['stripe checkout', '@/app/api/stripe/checkout/route', 'POST', '/api/stripe/checkout', { offer: 'pass' }],
  ['stripe portal', '@/app/api/stripe/portal/route', 'POST', '/api/stripe/portal', {}],
  ['tracker PATCH', '@/app/api/tracker/[id]/route', 'PATCH', '/api/tracker/appB', { notes: 'pwned' }, 'appB'],
  ['tracker DELETE', '@/app/api/tracker/[id]/route', 'DELETE', '/api/tracker/appB', undefined, 'appB'],
  ['tracker GET', '@/app/api/tracker/route', 'GET', '/api/tracker'],
  ['tracker POST', '@/app/api/tracker/route', 'POST', '/api/tracker', { title: 't', company: 'c', resumeId: 'resB' }],
]

async function call([, mod, method, url, body, id]: Case) {
  const m = await import(/* @vite-ignore */ mod)
  const handler = m[method]
  expect(handler, `${mod} exports ${method}`).toBeTypeOf('function')
  return (await handler(req(url, method, body), id ? ctx(id) : undefined)) as Response
}

beforeEach(() => {
  seed()
  h.state.dbTouched = []
  h.state.violations = []
  h.state.session = null
})

describe('signed out: every API route refuses before touching the database', () => {
  it.each(ROUTES)('%s -> 401', async (...c) => {
    const res = await call(c as Case)
    expect(res.status).toBe(401)
    expect(h.state.dbTouched).toEqual([])
    expect(await bodyText(res)).not.toContain(h.B_SECRET)
  }, 20000)

  it('health -> 404 (hides itself)', async () => {
    const { GET } = await import('@/app/api/health/route')
    const res = (await (GET as any)()) as Response
    expect(res.status).toBe(404)
    expect(h.state.dbTouched).toEqual([])
  })

  it('crons -> 401 without the bearer secret', async () => {
    for (const mod of ['@/app/api/keepalive/route', '@/app/api/cron/expire-entitlements/route']) {
      const { GET } = await import(/* @vite-ignore */ mod)
      const res = await GET(new Request('http://localhost/x'))
      expect(res.status).toBe(401)
    }
    expect(h.state.dbTouched).toEqual([])
  })

  it('stripe webhook -> 503/400 without a valid signature, no DB', async () => {
    const { POST } = await import('@/app/api/stripe/webhook/route')
    const res = await POST(req('/api/stripe/webhook', 'POST', {}))
    expect([400, 503]).toContain(res.status)
    expect(h.state.dbTouched).toEqual([])
  })
})

describe("signed in as A: B's rows are never read or written", () => {
  const idCases = ROUTES.filter(([label]) => !label.startsWith('admin'))
  it.each(idCases)('%s', async (...c) => {
    h.state.session = { user: A }
    const res = await call(c as Case)
    let text = await bodyText(res)
    // NDJSON bodies (parse) stream: the text above already drained it.
    expect(text, 'response leaks B data').not.toContain(h.B_SECRET)
    expect(h.state.violations).toEqual([])
    text = ''
  }, 20000)

  it('harness self-check: a write to B as A is caught', async () => {
    h.state.session = { user: A }
    await h.prisma.resume.update({ where: { id: 'resB' }, data: { title: 'x' } })
    expect(h.state.violations.length).toBe(1)
  })

  it('admin routes are 403 for a non-admin', async () => {
    h.state.session = { user: A }
    for (const c of ROUTES.filter(([label]) => label.startsWith('admin'))) {
      const res = await call(c)
      expect(res.status, c[0]).toBe(403)
    }
    expect(h.state.violations).toEqual([])
  })

  it("tailor with B's applicationId creates a new application for A instead of overwriting B's", async () => {
    h.state.session = { user: A }
    const { POST } = await import('@/app/api/resumes/[id]/tailor/route')
    const res = await POST(req('/api/resumes/resA/tailor', 'POST', { jobTitle: 't', company: 'c', description: 'd', applicationId: 'appB' }), ctx('resA'))
    expect(res.status).toBe(200)
    expect(h.state.violations).toEqual([])
    const appB = h.state.tables.jobApplication.find((r) => r.id === 'appB')!
    expect(appB.jobDescription).toBe(h.B_SECRET)
  })

  it("parse with replaces=B's resume does not hide B's resume", async () => {
    h.state.session = { user: A }
    const { POST } = await import('@/app/api/resumes/parse/route')
    const res = await POST(req('/api/resumes/parse', 'POST', { text: 'Jane Doe resume', replaces: 'resB' }))
    await res.text()
    expect(h.state.tables.resume.find((r) => r.id === 'resB')!.hiddenAt).toBeNull()
    expect(h.state.violations).toEqual([])
  })

  it("tracker POST with B's resumeId attaches the card to A's own resume", async () => {
    h.state.session = { user: A }
    const { POST } = await import('@/app/api/tracker/route')
    const res = await POST(req('/api/tracker', 'POST', { title: 't', company: 'c', resumeId: 'resB' }))
    expect(res.status).toBe(200)
    const created = h.state.tables.jobApplication.at(-1)!
    expect(created.resumeId).toBe('resA')
  })

  it("decideChange with B's changeId on A's own application is 404 (changes are looked up inside the owned row)", async () => {
    h.state.session = { user: A }
    h.state.tables.jobApplication.push({ ...h.state.tables.jobApplication[0], id: 'appA', userId: A.id, resumeId: 'resA', suggestions: { changes: [{ id: 'chgA', status: 'pending' }] } })
    const { PATCH } = await import('@/app/api/resumes/applications/[id]/route')
    const res = await PATCH(req('/api/resumes/applications/appA', 'PATCH', { changeId: 'chgB', status: 'accepted' }), ctx('appA'))
    expect(res.status).toBe(404)
  })
})
