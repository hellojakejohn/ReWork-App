import { describe, expect, it } from 'vitest'
import { pullListBoards, syncBoard, toJobRow, type JobRow } from '@/lib/feed/sync'
import { parseWorkdaySearch, workdayPostedAt, workdaySearchRequest } from '@/lib/feed/boards'
import { LIST_BOARDS, WORKDAY_BOARDS } from '@/lib/feed/board-list'

// A tiny in-memory stand-in for prisma.job: just the calls syncBoard makes.
type Row = Omit<JobRow, 'closedAt'> & { closedAt?: Date | null }
function fakeDb(initial: Row[] = []) {
  const rows = new Map<string, Row>(initial.map((r) => [r.id, { closedAt: null, ...r }]))
  const match = (where: { board?: string; id?: { in: string[] } }) => [...rows.values()].filter((r) => (where.board ? r.board === where.board : true) && (where.id ? where.id.in.includes(r.id) : true))
  const job = {
    findMany: async ({ where }: { where: { board?: string; id?: { in: string[] } } }) => match(where).map((r) => ({ id: r.id, closedAt: r.closedAt ?? null })),
    createMany: async ({ data }: { data: Row[] }) => {
      for (const d of data) if (!rows.has(d.id)) rows.set(d.id, { closedAt: null, ...d })
      return { count: data.length }
    },
    updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: Partial<Row> }) => {
      const hit = match(where)
      for (const r of hit) Object.assign(r, data)
      return { count: hit.length }
    },
  }
  return { db: { job } as never, rows }
}

const desc = 'Build the checkout UI in React. The base salary range is $120,000 - $150,000 per year. '.repeat(2)
const row = (id: string, extra: Partial<Row> = {}): Row => ({
  ...(toJobRow({ key: id, board: 'greenhouse:acme', source: 'greenhouse', title: 'Engineer', company: 'Acme', location: 'Remote - US', description: desc, url: 'u' }, new Date('2026-11-01')) as Row),
  ...extra,
})

describe('toJobRow', () => {
  it('works out place, remote and pay once', () => {
    const r = toJobRow({ key: 'k', board: 'b', source: 'greenhouse', title: 'Ops', company: 'Acme', location: 'Minneapolis, MN', description: desc, url: 'u', facts: { posted: '2026-11-02T00:00:00Z' } })
    expect(r).toMatchObject({ usState: 'MN', country: 'us', remote: false, payLabel: '$120k to $150k a year' })
    expect((r.postedAt as Date).toISOString()).toBe('2026-11-02T00:00:00.000Z')
  })
})

describe('syncBoard', () => {
  const now = new Date('2026-11-09')
  it('adds new jobs, marks listed ones seen, closes the ones gone from a full board', async () => {
    const { db, rows } = fakeDb([row('a'), row('b'), row('old', { board: 'greenhouse:other' })])
    const r = await syncBoard(db, 'greenhouse:acme', [row('b'), row('c')] as JobRow[], { complete: true, now })
    expect(r).toMatchObject({ listed: 2, added: 1, closed: 1, reopened: 0 })
    expect(rows.get('a')?.closedAt).toEqual(now)
    expect(rows.get('b')?.lastSeenAt).toEqual(now)
    expect(rows.get('c')).toBeDefined()
    expect(rows.get('old')?.closedAt).toBeNull() // another board is untouched
  })
  it('reopens a job that comes back, and never closes on a partial (search) read', async () => {
    const { db, rows } = fakeDb([row('a', { closedAt: new Date('2026-11-05') }), row('b')])
    const r = await syncBoard(db, 'greenhouse:acme', [row('a')] as JobRow[], { complete: false, now })
    expect(r).toMatchObject({ added: 0, closed: 0, reopened: 1 })
    expect(rows.get('a')?.closedAt).toBeNull()
    expect(rows.get('b')?.closedAt).toBeNull()
  })
})

describe('pullListBoards', () => {
  const now = new Date('2026-11-09')
  const gh = (ids: number[]) => ({ jobs: ids.map((id) => ({ id, title: 'Engineer', absolute_url: `u${id}`, location: { name: 'Remote' }, content: `&lt;p&gt;${desc}&lt;/p&gt;` })) })
  it('syncs boards that answer and logs the ones that fail', async () => {
    const { db, rows } = fakeDb()
    const fetchFn = (async (url: string) =>
      url.includes('/acme/') ? new Response(JSON.stringify(gh([1, 2]))) : new Response('nope', { status: 404 })) as unknown as typeof fetch
    const s = await pullListBoards(db, [{ ats: 'greenhouse', slug: 'acme' }, { ats: 'greenhouse', slug: 'gone' }], { fetchFn, now })
    expect(s).toMatchObject({ boards: 2, ok: 1, listed: 2, added: 2, skipped: 0 })
    expect(s.failed).toEqual(['greenhouse:gone: HTTP 404'])
    expect([...rows.keys()].sort()).toEqual(['greenhouse:acme:1', 'greenhouse:acme:2'])
  })
  it('treats an empty answer as not read, so nothing closes', async () => {
    const { db, rows } = fakeDb([row('greenhouse:acme:1')])
    const fetchFn = (async () => new Response(JSON.stringify({ jobs: [] }))) as unknown as typeof fetch
    await pullListBoards(db, [{ ats: 'greenhouse', slug: 'acme' }], { fetchFn, now })
    expect(rows.get('greenhouse:acme:1')?.closedAt).toBeNull()
  })
  it('skips what is left once past the deadline', async () => {
    const { db } = fakeDb()
    const fetchFn = (async () => new Response(JSON.stringify(gh([1])))) as unknown as typeof fetch
    const s = await pullListBoards(db, [{ ats: 'greenhouse', slug: 'a' }, { ats: 'greenhouse', slug: 'b' }], { fetchFn, now, deadlineMs: -1, concurrency: 1 })
    expect(s).toMatchObject({ ok: 0, skipped: 2 })
  })
})

describe('Workday search', () => {
  const b = { company: 'Target', tenant: 'target', host: 'target.wd5.myworkdayjobs.com', site: 'targetcareers' }
  const now = new Date('2026-11-09T12:00:00Z')
  it('builds the search call and reads the results without descriptions', () => {
    const req = workdaySearchRequest(b, 'Operations Coordinator', 20)
    expect(req.url).toBe('https://target.wd5.myworkdayjobs.com/wday/cxs/target/targetcareers/jobs')
    expect(JSON.parse(req.body)).toMatchObject({ searchText: 'Operations Coordinator', offset: 20, limit: 20 })
    const jobs = parseWorkdaySearch(b, {
      jobPostings: [
        { title: 'Operations Coordinator', externalPath: '/job/Minneapolis-MN/Operations-Coordinator_R0012345', locationsText: 'Minneapolis, MN', postedOn: 'Posted 3 Days Ago', bulletFields: ['R0012345'] },
        { title: '', externalPath: '/job/x' },
      ],
    }, now)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({ key: 'workday:target:R0012345', board: 'workday:target', company: 'Target', description: '', url: 'https://target.wd5.myworkdayjobs.com/targetcareers/job/Minneapolis-MN/Operations-Coordinator_R0012345' })
    expect(jobs[0].postedAt?.toISOString()).toBe('2026-11-06T12:00:00.000Z')
  })
  it('reads Workday posted text', () => {
    expect(workdayPostedAt('Posted Today', now)).toEqual(now)
    expect(workdayPostedAt('Posted 30+ Days Ago', now)?.toISOString()).toBe('2026-10-10T12:00:00.000Z')
    expect(workdayPostedAt('', now)).toBeNull()
  })
})

describe('board list', () => {
  it('has no repeats', () => {
    const ids = LIST_BOARDS.map((b) => `${b.ats}:${b.slug}`)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(WORKDAY_BOARDS.map((b) => b.tenant)).size).toBe(WORKDAY_BOARDS.length)
  })
})
