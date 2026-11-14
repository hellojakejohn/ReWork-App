import { describe, expect, it } from 'vitest'
import { parseUsajobs, searchUsajobs, usajobsConfigured, usajobsQueries, USAJOBS_BOARD } from '@/lib/feed/usajobs'
import { closeStaleSearched } from '@/lib/feed/sync'

/* eslint-disable @typescript-eslint/no-explicit-any */
const item = (over: any = {}) => ({
  MatchedObjectId: '812345600',
  MatchedObjectDescriptor: {
    PositionID: 'VHA-26-123',
    PositionTitle: 'Registered Nurse (Care Coordinator)',
    PositionURI: 'https://www.usajobs.gov/job/812345600',
    PositionLocationDisplay: 'Minneapolis, Minnesota',
    OrganizationName: 'Veterans Health Administration',
    PositionRemuneration: [{ MinimumRange: '84000', MaximumRange: '125000', RateIntervalCode: 'PA' }],
    QualificationSummary: 'Graduate of an accredited school of nursing. Current, full RN license.',
    PublicationStartDate: '2026-11-01T00:00:00.0000',
    ApplicationCloseDate: '2026-12-01T23:59:59.9970',
    UserArea: { Details: { JobSummary: 'Coordinate care for Veterans with chronic conditions.', MajorDuties: ['Care plans', 'Transitions of care'], RemoteIndicator: false } },
    ...over,
  },
})
const answer = (items: any[]) => ({ SearchResult: { SearchResultItems: items } })
const now = new Date('2026-11-14T12:00:00Z')

describe('USAJOBS', () => {
  it('is off without both the key and the email', () => {
    expect(usajobsConfigured({} as never)).toBeNull()
    expect(usajobsConfigured({ USAJOBS_API_KEY: 'k' } as never)).toBeNull()
    expect(usajobsConfigured({ USAJOBS_API_KEY: 'k', USAJOBS_EMAIL: 'a@b.c' } as never)).toEqual({ key: 'k', email: 'a@b.c' })
  })

  it('searches their state and remote, per where they want to work', () => {
    const both = usajobsQueries(['RN Care Coordinator'], 'both', 'MN')
    expect(both).toHaveLength(2)
    expect(both[0]).toContain('LocationName=Minnesota')
    expect(both[1]).toContain('RemoteIndicator=True')
    expect(usajobsQueries(['Nurse'], 'near', 'MN')).toHaveLength(1)
    expect(usajobsQueries(['Nurse'], 'remote', 'MN')[0]).toContain('RemoteIndicator=True')
    expect(usajobsQueries(['Nurse'], 'near', null)[0]).toContain('RemoteIndicator=True')
  })

  it('reads title, agency, place, pay and the duties into the job text', () => {
    const [job] = parseUsajobs(answer([item()]), now)
    expect(job).toMatchObject({ key: 'usajobs:812345600', board: USAJOBS_BOARD, source: 'usajobs', title: 'Registered Nurse (Care Coordinator)', company: 'Veterans Health Administration', location: 'Minneapolis, Minnesota', url: 'https://www.usajobs.gov/job/812345600' })
    expect(job.description).toContain('Pay: $84,000 to $125,000 a year')
    expect(job.description).toContain('- Transitions of care')
    expect(job.description).toContain('Qualifications:')
    expect(job.facts).toMatchObject({ closes: '2026-12-01', pay: true })
  })

  it('leaves out closed postings and marks remote ones', () => {
    expect(parseUsajobs(answer([item({ ApplicationCloseDate: '2026-11-01T00:00:00' })]), now)).toEqual([])
    const [job] = parseUsajobs(answer([item({ PositionLocationDisplay: 'Anywhere in the U.S.', UserArea: { Details: { RemoteIndicator: true, JobSummary: 'x' } } })]), now)
    expect(job.location).toBe('Anywhere in the U.S., Remote')
  })

  it('sends the key and email, saves the jobs, and does nothing without a key', async () => {
    const created: any[] = []
    const db: any = { job: { findMany: async () => [], createMany: async ({ data }: any) => { created.push(...data); return { count: data.length } }, updateMany: async () => ({ count: 0 }) } }
    const seen: any[] = []
    const fetchFn = (async (url: string, init: any) => { seen.push(init.headers); return new Response(JSON.stringify(answer([item()]))) }) as never
    expect(await searchUsajobs(db, ['u1'], { fetchFn, now, auth: null })).toBe(0)
    expect(await searchUsajobs(db, ['u1', 'u2'], { fetchFn, now, auth: { key: 'k', email: 'a@b.c' } })).toBe(1)
    expect(seen[0]).toMatchObject({ 'User-Agent': 'a@b.c', 'Authorization-Key': 'k' })
    expect(created[0]).toMatchObject({ id: 'usajobs:812345600', usState: 'MN', payLabel: '$84k to $125k a year' })
  })
})

describe('closeStaleSearched', () => {
  it('closes Workday jobs unseen for 30 days and USAJOBS jobs unseen for 14', async () => {
    const calls: any[] = []
    const db: any = { job: { updateMany: async (q: any) => { calls.push(q); return { count: 2 } } } }
    expect(await closeStaleSearched(db, now)).toBe(4)
    expect(calls[0].where).toMatchObject({ source: 'workday', closedAt: null })
    expect(calls[0].where.matches.none.OR).toHaveLength(2)
    expect(calls[0].where.lastSeenAt.lt.toISOString()).toBe('2026-10-15T12:00:00.000Z')
    expect(calls[1].where.lastSeenAt.lt.toISOString()).toBe('2026-10-31T12:00:00.000Z')
  })
})
