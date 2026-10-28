// Audit (launch-audit branch): the tailor route's partial failures with everything below
// it mocked (session, DB, quota, AI cap, the model call). Is the monthly reservation given
// back, and does the user get a truthful message? `it.fails` = a bug.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  release: vi.fn(async () => {}),
  createFails: false,
  resumeUpdateFails: false,
  modelError: null as any,
  created: 0,
}))

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1', email: 'u1@example.com' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/track', () => ({ track: vi.fn(async () => {}), msSince: () => 1 }))
vi.mock('@/lib/daily-ceiling', () => ({ checkDailyCeiling: vi.fn(async () => ({ allowed: true })) }))
vi.mock('@/lib/ai-cap', () => ({
  getAIBudget: vi.fn(async () => ({ state: { band: 'normal' }, scope: {}, settle: async () => {} })),
  aiPausedCheck: vi.fn(async () => null),
}))
vi.mock('@/lib/tailor-quota', () => ({
  getTailorQuota: vi.fn(async () => ({ isPro: false, used: 0, limit: 3, remaining: 3, allowed: true })),
  reserveMonthly: vi.fn(async () => ({ release: h.release })),
}))
vi.mock('@/lib/application-dto', () => ({ toApplicationDetail: (a: any) => a }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    resume: {
      findUnique: vi.fn(async () => ({
        id: 'res1',
        userId: 'u1',
        isActive: true,
        contactInfo: {},
        professionalSummary: 'Cook.',
        workExperience: [{ jobTitle: 'Cook', company: 'Diner', startDate: '2020', endDate: 'present', achievements: ['Cooked'] }],
        education: [],
        skills: [],
        projects: [],
        additionalSections: null,
        evidence: null,
      })),
      update: vi.fn(async () => {
        if (h.resumeUpdateFails) throw new Error('db blip')
      }),
    },
    jobApplication: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: any) => {
        if (h.createFails) throw new Error('db blip')
        h.created++
        return { id: 'app1', ...data }
      }),
    },
  },
}))
vi.mock('@/lib/tailor', async (orig) => {
  const actual: any = await orig()
  return {
    ...actual,
    callTailorModel: vi.fn(async () => {
      if (h.modelError) throw h.modelError
      return {
        model: 'claude-opus-5-5',
        output: {
          targetKeywords: ['cooking'],
          summary: 'Cook.',
          roles: [{ id: 'role_0', title: 'Cook', company: 'Diner', startDate: '2020', endDate: 'present', bullets: [{ text: 'Cooked', reason: '' }] }],
          education: [],
          projects: [],
          skills: [],
        },
      }
    }),
  }
})

import { POST } from '@/app/api/resumes/[id]/tailor/route'
import { readNdjson } from '@/lib/ndjson'
import { TailorError } from '@/lib/tailor'

const body = { jobTitle: 'Chef', company: 'Bistro', description: 'Cook food.' }
const post = (ndjson = false) =>
  POST(
    new Request('http://x/api/resumes/res1/tailor', {
      method: 'POST',
      headers: ndjson ? { accept: 'application/x-ndjson' } : {},
      body: JSON.stringify(body),
    }) as any,
    { params: Promise.resolve({ id: 'res1' }) }
  )

beforeEach(() => {
  h.release.mockClear()
  Object.assign(h, { createFails: false, resumeUpdateFails: false, modelError: null, created: 0 })
})

describe('tailor route partial failures', () => {
  it('happy path keeps the reservation', async () => {
    const res = await post()
    expect(res.status).toBe(200)
    expect(h.release).not.toHaveBeenCalled()
  })

  it('model error (declined / busy): reservation released, server message passed through', async () => {
    h.modelError = new TailorError('refused', 422, 'declined msg', 'invalid_output')
    const res = await post()
    expect(res.status).toBe(422)
    expect((await res.json()).error).toBe('declined msg')
    expect(h.release).toHaveBeenCalledTimes(1)
  })

  it('model OK but the application write fails: reservation released, nothing half-written (JSON)', async () => {
    h.createFails = true
    const res = await post()
    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/didn't count toward your limit/)
    expect(h.release).toHaveBeenCalledTimes(1)
    expect(h.created).toBe(0)
  })

  it('same over ndjson: an error event, reservation released', async () => {
    h.createFails = true
    const res = await post(true)
    const events: any[] = []
    await readNdjson(res, (e) => events.push(e))
    expect(events.at(-1)).toMatchObject({ type: 'error', status: 500 })
    expect(h.release).toHaveBeenCalledTimes(1)
  })

  // Correct: once the application is saved (and the use kept), a failure of the follow-up
  // `resume.update({ lastOptimized })` should not turn into "Tailoring failed ... didn't
  // count toward your limit". Today the user sees a failure, the tailor DID count, and the
  // application sits in Recent. Make lastOptimized best-effort (.catch) or send done first.
  it('a failed lastOptimized update after the save still returns the saved application', async () => {
    h.resumeUpdateFails = true
    const res = await post()
    expect(h.created).toBe(1)
    expect(h.release).not.toHaveBeenCalled() // the use was kept...
    expect(res.status).toBe(200) // ...so the user should get the result, not "didn't count"
  })
})
