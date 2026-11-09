import { describe, expect, it, vi } from 'vitest'
import { placeFilter, runMatch, searchTitles } from '@/lib/feed/match'
import type { ParsedResume } from '@/types/parsed-resume'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

// In-memory prisma: only the queries the matcher makes.
function fakeDb(jobs: Row[] = []) {
  const job = new Map<string, Row>(jobs.map((j) => [j.id, { closedAt: null, keywords: [], description: '', remote: false, usState: null, country: 'us', ...j }]))
  const matches = new Map<string, Row>()
  const prefs = new Map<string, Row>()
  const where = (r: Row, w: Row): boolean =>
    Object.entries(w).every(([k, v]) => {
      if (k === 'OR') return (v as Row[]).some((o) => where(r, o))
      if (v && typeof v === 'object' && 'in' in v) return (v.in as string[]).includes(r[k])
      if (v && typeof v === 'object' && 'not' in v) return r[k] !== v.not
      return (r[k] ?? null) === v
    })
  const db = {
    job: {
      findMany: async ({ where: w }: Row) => [...job.values()].filter((r) => where(r, w)).map((r) => ({ ...r })),
      createMany: async ({ data }: Row) => {
        for (const d of data) if (!job.has(d.id)) job.set(d.id, { closedAt: null, ...d })
        return { count: data.length }
      },
      updateMany: async ({ where: w, data }: Row) => {
        const hit = [...job.values()].filter((r) => where(r, w))
        hit.forEach((r) => Object.assign(r, data))
        return { count: hit.length }
      },
      update: async ({ where: w, data }: Row) => Object.assign(job.get(w.id)!, data),
    },
    jobMatch: {
      upsert: async ({ where: w, create, update }: Row) => {
        const k = `${w.resumeId_jobId.resumeId}|${w.resumeId_jobId.jobId}`
        matches.set(k, matches.has(k) ? { ...matches.get(k), ...update } : { ...create })
      },
    },
    feedPrefs: { upsert: async ({ where: w, create, update }: Row) => prefs.set(w.resumeId, { ...(prefs.get(w.resumeId) ?? create), ...update }) },
  }
  return { db: db as never, job, matches, prefs }
}

const resume: ParsedResume = {
  contact: { fullName: 'Marcus Hill', headline: '', email: '', phone: '', location: 'Saint Paul, MN', links: [] },
  summary: 'Restaurant general manager',
  skills: [{ group: '', items: ['Excel', 'Scheduling', 'Vendor management', 'Inventory'] }],
  experience: [{ id: 'e1', title: 'General Manager', company: 'Riverside Grill', location: '', startDate: '2018-01', endDate: 'present', current: true, bullets: ['Ran weekly inventory and vendor ordering in Excel', 'Scheduled 28 staff'] }],
  projects: [],
  education: [],
  certifications: [],
  extraSections: [],
}
const prefs = { targetTitles: ['Operations Coordinator'], workplace: 'both' as const }
const text = 'Coordinate vendors, scheduling and inventory. Excel required. Track purchase orders and work orders. '.repeat(3)
const board = { company: 'Target', tenant: 'target', host: 'target.wd5.myworkdayjobs.com', site: 'careers' }

function fetchStub() {
  return vi.fn(async (url: string, init?: { method?: string }) => {
    if (init?.method === 'POST')
      return new Response(JSON.stringify({ jobPostings: [{ title: 'Operations Coordinator', externalPath: '/job/Minneapolis-MN/Operations-Coordinator_R1', locationsText: 'Minneapolis, MN', postedOn: 'Posted Today', bulletFields: ['R1'] }] }))
    if (url.includes('/wday/cxs/target/careers/job/')) return new Response(JSON.stringify({ jobPostingInfo: { title: 'Operations Coordinator', location: 'Minneapolis, MN', jobDescription: `<p>${text}</p>` } }))
    return new Response('{}', { status: 404 })
  }) as unknown as typeof fetch
}

describe('searchTitles and placeFilter', () => {
  it('searches their target, else their latest title', () => {
    expect(searchTitles(resume, prefs)).toEqual(['Operations Coordinator'])
    expect(searchTitles(resume, { targetTitles: [' '], workplace: 'both' })).toEqual(['General Manager'])
  })
  it('limits jobs to remote, near home, or both', () => {
    expect(placeFilter('remote', 'MN')).toMatchObject({ remote: true })
    expect(placeFilter('near', 'MN')).toMatchObject({ usState: 'MN' })
    expect(placeFilter('both', 'MN')).toMatchObject({ OR: [{ remote: true }, { usState: 'MN' }] })
    expect(placeFilter('both', null)).toMatchObject({ remote: true })
  })
})

describe('runMatch', () => {
  const base = [
    { id: 'gh:a:1', source: 'greenhouse', board: 'greenhouse:a', company: 'Acme', title: 'Operations Coordinator', location: 'Remote - US', remote: true, description: text, url: 'u1' },
    { id: 'gh:a:2', source: 'greenhouse', board: 'greenhouse:a', company: 'Acme', title: 'Senior Software Engineer', location: 'Remote - US', remote: true, description: 'Go and Kubernetes. '.repeat(10), url: 'u2' },
    { id: 'gh:a:3', source: 'greenhouse', board: 'greenhouse:a', company: 'Acme', title: 'Operations Coordinator', location: 'Austin, TX', usState: 'TX', description: text, url: 'u3' },
    { id: 'gh:a:4', source: 'greenhouse', board: 'greenhouse:a', company: 'Acme', title: 'Operations Associate', location: 'Berlin', country: 'other', description: text, url: 'u4' },
  ]
  const keywords = ['vendor management', 'scheduling', 'inventory', 'Excel', 'work orders', 'purchase orders']

  it('finds Workday jobs, fills their text, buys keywords once, and scores with the real match', async () => {
    const { db, job, matches, prefs: saved } = fakeDb(base)
    const extract = vi.fn(async () => keywords)
    const fetchFn = fetchStub()
    const run = await runMatch({ db, fetchFn, extract, workdayBoards: [board] }, { userId: 'u', resumeId: 'r', resume, prefs })

    expect(run.workdayJobs).toBe(1)
    expect(job.get('workday:target:R1')?.description).toContain('Coordinate vendors')
    expect(run).toMatchObject({ fetched: 1, extracted: 2, scored: 2 })
    // Only jobs in their area, with a related title: not the engineer, not Austin, not Berlin.
    expect([...matches.values()].map((m) => m.jobId).sort()).toEqual(['gh:a:1', 'workday:target:R1'])
    const m = matches.get('r|gh:a:1')!
    expect(m.score).toBeGreaterThan(40)
    expect(m.missing).toContain('work orders')
    expect(saved.get('r')?.matchedAt).toBeInstanceOf(Date)

    // Second run: keywords are on the jobs now, so no new model calls.
    const again = await runMatch({ db, fetchFn, extract, workdayBoards: [board] }, { userId: 'u', resumeId: 'r', resume, prefs })
    expect(again.extracted).toBe(0)
    expect(extract).toHaveBeenCalledTimes(2)
  })

  it('stops buying keywords when the budget says no, and keeps a dismissed match dismissed', async () => {
    const { db, matches } = fakeDb(base)
    const run = await runMatch({ db, fetchFn: fetchStub(), extract: vi.fn(async () => keywords), canSpend: () => false, workdayBoards: [board] }, { userId: 'u', resumeId: 'r', resume, prefs })
    expect(run).toMatchObject({ extracted: 0, scored: 0 })
    expect(run.skippedNoBudget).toBeGreaterThan(0)

    await runMatch({ db, fetchFn: fetchStub(), extract: vi.fn(async () => keywords), workdayBoards: [] }, { userId: 'u', resumeId: 'r', resume, prefs })
    matches.get('r|gh:a:1')!.dismissedAt = new Date()
    await runMatch({ db, fetchFn: fetchStub(), extract: vi.fn(async () => keywords), workdayBoards: [] }, { userId: 'u', resumeId: 'r', resume, prefs })
    expect(matches.get('r|gh:a:1')!.dismissedAt).toBeInstanceOf(Date)
  })

  it('survives employers that time out and a failed keyword call', async () => {
    const { db } = fakeDb(base)
    const fetchFn = vi.fn(async () => {
      throw new Error('timeout')
    }) as unknown as typeof fetch
    const extract = vi.fn(async () => {
      throw new Error('model down')
    })
    const run = await runMatch({ db, fetchFn, extract, workdayBoards: [board] }, { userId: 'u', resumeId: 'r', resume, prefs })
    expect(run).toMatchObject({ workdayJobs: 0, scored: 0 })
  })
})
