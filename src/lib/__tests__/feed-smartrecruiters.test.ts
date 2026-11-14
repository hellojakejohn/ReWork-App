import { describe, expect, it } from 'vitest'
import { parseSmartRecruitersList, pullSmartRecruiters } from '@/lib/feed/smartrecruiters'
import { matchAtsUrl } from '@/lib/job-resolve/ats'

/* eslint-disable @typescript-eslint/no-explicit-any */
const b = { id: 'Equinox', company: 'Equinox' }
const post = (id: string, over: any = {}) => ({ id, name: 'Front Desk Associate', company: { name: 'Equinox' }, releasedDate: '2026-11-10T00:00:00Z', location: { city: 'Woodbury', region: 'MN', country: 'us', remote: false }, ...over })

describe('SmartRecruiters', () => {
  it('reads title, place and a link the resolver can open', () => {
    const [j] = parseSmartRecruitersList(b, { content: [post('744000161589749')] })
    expect(j).toMatchObject({ key: 'smartrecruiters:Equinox:744000161589749', board: 'smartrecruiters:Equinox', source: 'smartrecruiters', title: 'Front Desk Associate', location: 'Woodbury, MN', description: '' })
    expect(matchAtsUrl(j.url)?.ats).toBe('smartrecruiters')
    const [r] = parseSmartRecruitersList(b, { content: [post('745', { location: { remote: true } })] })
    expect(r.location).toBe('Remote')
  })

  it('reads every page and closes gone jobs only after a full read', async () => {
    const pages = [{ totalFound: 150, content: Array.from({ length: 100 }, (_, i) => post(`a${i}`)) }, { totalFound: 150, content: Array.from({ length: 50 }, (_, i) => post(`b${i}`)) }]
    let call = 0
    const fetchFn = (async () => new Response(JSON.stringify(pages[call++]))) as never
    const rows: any[] = []
    const db: any = { job: { findMany: async () => [{ id: 'smartrecruiters:Equinox:old', closedAt: null }], createMany: async ({ data }: any) => { rows.push(...data); return { count: data.length } }, updateMany: async ({ data }: any) => ({ count: data.closedAt ? 1 : 0 }) } }
    const r = await pullSmartRecruiters(db, b, { fetchFn })
    expect(call).toBe(2)
    expect(r).toMatchObject({ listed: 150, added: 150, closed: 1 })
    expect(rows[0]).toMatchObject({ usState: 'MN', description: '' })
  })
})
