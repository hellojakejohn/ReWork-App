import { describe, expect, it, vi } from 'vitest'
import { checkJob } from '@/lib/job-check'

const NOW = new Date('2026-11-23T12:00:00Z')
const LONG = 'You will coordinate shipments, schedule carriers, and keep inventory records accurate across two warehouses. '.repeat(4)

function greenhouse(content: string, extra: Record<string, unknown> = {}) {
  return vi.fn(async () => ({
    status: 200,
    url: 'x',
    text: JSON.stringify({ title: 'Logistics Coordinator', location: { name: 'Saint Paul, MN' }, company_name: 'Northwind', content, ...extra }),
  }))
}
const LINK = 'https://boards.greenhouse.io/northwind/jobs/123'

describe('checkJob', () => {
  it('a clean link on a board we pull: still open, and says what looked fine', async () => {
    const findBoardJob = vi.fn(async () => ({ company: 'Northwind', firstSeenAt: new Date('2026-11-01'), closedAt: null }))
    const out = await checkJob(LINK, {
      fetchPage: greenhouse(`${LONG} Pay: $55,000 to $65,000 a year.`, { first_published: '2026-11-15T00:00:00Z' }),
      findBoardJob,
      countCompanyOpen: async () => 42,
      now: NOW,
    })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(findBoardJob).toHaveBeenCalledWith('greenhouse', '123')
    expect(out.result.scam).toEqual([])
    expect(out.result.ghost).toEqual([])
    expect(out.result.board).toMatchObject({ open: true, companyOpenJobs: 42 })
    expect(out.result.fine.join(' ')).toMatch(/still open on the employer's own job board/)
    expect(out.result.fine.join(' ')).toMatch(/Pay is listed/)
    expect(out.result.fine.join(' ')).toMatch(/posted recently/)
  })

  it('a job the board already closed leads the ghost signs', async () => {
    const out = await checkJob(LINK, {
      fetchPage: greenhouse(LONG),
      findBoardJob: async () => ({ company: 'Northwind', firstSeenAt: new Date('2026-09-01'), closedAt: new Date('2026-11-20T06:00:00Z') }),
      now: NOW,
    })
    if (!out.ok) throw new Error('expected ok')
    expect(out.result.ghost[0]).toMatchObject({ id: 'closed' })
    expect(out.result.ghost[0].label).toMatch(/Nov 20, 2026/)
    expect(out.result.ghost.map((g) => g.id)).toContain('no_pay')
    expect(out.result.fine.join(' ')).not.toMatch(/still open/)
  })

  it('a pasted scam post: scam signs with the quote, no fetch', async () => {
    const fetchPage = vi.fn()
    const post = `Data Entry Clerk\n${LONG}\nTo get started, contact our hiring manager on Telegram and buy your equipment with a check we send you. Send a copy of your SSN and bank details with your application.`
    const out = await checkJob(post, { fetchPage, now: NOW })
    expect(fetchPage).not.toHaveBeenCalled()
    if (!out.ok) throw new Error('expected ok')
    expect(out.result.fromLink).toBe(false)
    expect(out.result.scam.length).toBeGreaterThanOrEqual(2)
    expect(out.result.fine.join(' ')).not.toMatch(/No asks for money/)
  })

  it('LinkedIn and unreadable links ask for the text', async () => {
    const out = await checkJob('https://www.linkedin.com/jobs/view/123', { fetchPage: vi.fn(), now: NOW })
    expect(out).toMatchObject({ ok: false, needsPaste: true })
    const broken = await checkJob(LINK, { fetchPage: vi.fn(async () => { throw new Error('timeout') }), now: NOW })
    expect(broken).toMatchObject({ ok: false, needsPaste: true })
  })

  it('nonsense gets a plain ask', async () => {
    expect(await checkJob('hello there', { fetchPage: vi.fn(), now: NOW })).toMatchObject({ ok: false, error: 'Paste one job link, or the whole job post.' })
  })
})
