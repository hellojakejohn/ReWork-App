import { describe, expect, it } from 'vitest'
import { adzunaConfigured, adzunaQueries, parseAdzuna, searchAdzuna, ADZUNA_BOARD } from '@/lib/feed/adzuna'

/* eslint-disable @typescript-eslint/no-explicit-any */
const ad = (over: any = {}) => ({
  id: '4987654321',
  title: '<strong>Warehouse</strong> Associate - 2nd Shift',
  description: 'Pick, pack and ship orders. Forklift experience a plus &amp; safety first. Lift up to 50 lbs...',
  redirect_url: 'https://www.adzuna.com/land/ad/4987654321?se=abc',
  created: '2026-11-18T09:30:00Z',
  company: { display_name: 'Acme Logistics' },
  location: { display_name: 'Saint Paul, Ramsey County', area: ['US', 'Minnesota', 'Ramsey County', 'Saint Paul'] },
  salary_min: 39000,
  salary_max: 43000,
  salary_is_predicted: '0',
  ...over,
})
const answer = (results: any[]) => ({ results, count: results.length })
const now = new Date('2026-11-20T12:00:00Z')

describe('Adzuna', () => {
  it('is off without both keys', () => {
    expect(adzunaConfigured({} as never)).toBeNull()
    expect(adzunaConfigured({ ADZUNA_APP_ID: 'i' } as never)).toBeNull()
    expect(adzunaConfigured({ ADZUNA_APP_ID: 'i', ADZUNA_APP_KEY: 'k' } as never)).toEqual({ appId: 'i', appKey: 'k' })
  })

  it('searches their state and remote, per where they want to work, without keys in the URL', () => {
    const both = adzunaQueries(['Warehouse Associate'], 'both', 'MN')
    expect(both).toHaveLength(2)
    expect(both[0]).toContain('where=Minnesota')
    expect(both[1]).toContain('what_and=remote')
    expect(both.join(' ')).not.toContain('app_key')
    expect(adzunaQueries(['x'], 'near', 'MN')).toHaveLength(1)
    expect(adzunaQueries(['x'], 'remote', 'MN')[0]).toContain('what_and=remote')
    expect(adzunaQueries(['x'], 'near', null)[0]).toContain('what_and=remote')
  })

  it('reads a plain title, company, city and state, real pay and the preview', () => {
    const [job] = parseAdzuna(answer([ad()]))
    expect(job).toMatchObject({ key: 'adzuna:4987654321', board: ADZUNA_BOARD, source: 'adzuna', title: 'Warehouse Associate - 2nd Shift', company: 'Acme Logistics', location: 'Saint Paul, MN', url: 'https://www.adzuna.com/land/ad/4987654321?se=abc' })
    expect(job.description).toContain('Pay: $39,000 to $43,000 a year')
    expect(job.description).toContain('Forklift experience a plus & safety first.')
    expect(job.facts).toMatchObject({ posted: '2026-11-18', pay: true })
  })

  it("leaves out Adzuna's own pay guesses, reads hourly rates, and marks remote", () => {
    expect(parseAdzuna(answer([ad({ salary_is_predicted: '1' })]))[0].description).not.toContain('Pay:')
    expect(parseAdzuna(answer([ad({ salary_min: 18.5, salary_max: 21 })]))[0].description).toContain('Pay: $18.50 to $21 an hour')
    const [remote] = parseAdzuna(answer([ad({ title: 'Remote Customer Service Rep', location: { display_name: 'US', area: ['US'] } })]))
    expect(remote.location).toBe('United States, Remote')
    const [state] = parseAdzuna(answer([ad({ location: { display_name: 'Minnesota', area: ['US', 'Minnesota'] } })]))
    expect(state.location).toBe('Minnesota')
  })

  it('skips ads without an id, title or https link', () => {
    expect(parseAdzuna(answer([ad({ id: '' }), ad({ title: '' }), ad({ redirect_url: 'http://x.y' })]))).toEqual([])
    expect(parseAdzuna({})).toEqual([])
  })

  it('adds the keys at fetch time, saves the jobs, and does nothing without keys', async () => {
    const created: any[] = []
    const db: any = { job: { findMany: async () => [], createMany: async ({ data }: any) => { created.push(...data); return { count: data.length } }, updateMany: async () => ({ count: 0 }) } }
    const seen: string[] = []
    const fetchFn = (async (url: string) => { seen.push(url); return new Response(JSON.stringify(answer([ad()]))) }) as never
    const urls = adzunaQueries(['Warehouse Associate'], 'both', 'MN')
    expect(await searchAdzuna(db, urls, { fetchFn, now, auth: null })).toBe(0)
    expect(seen).toHaveLength(0)
    expect(await searchAdzuna(db, urls, { fetchFn, now, auth: { appId: 'i', appKey: 'k' } })).toBe(1)
    expect(seen[0]).toContain('app_id=i')
    expect(seen[0]).toContain('app_key=k')
    expect(created[0]).toMatchObject({ id: 'adzuna:4987654321', source: 'adzuna', usState: 'MN', payLabel: expect.stringContaining('$39') })
  })

  it('never fails the match when Adzuna errors', async () => {
    const db: any = { job: {} }
    const fetchFn = (async () => new Response('nope', { status: 429 })) as never
    expect(await searchAdzuna(db, ['https://api.adzuna.com/x'], { fetchFn, now, auth: { appId: 'i', appKey: 'k' } })).toBe(0)
    const boom = (async () => { throw new Error('timeout') }) as never
    expect(await searchAdzuna(db, ['https://api.adzuna.com/x'], { fetchFn: boom, now, auth: { appId: 'i', appKey: 'k' } })).toBe(0)
  })
})
