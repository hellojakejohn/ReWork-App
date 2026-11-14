import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ app: null as null | { keywords: string[] }, job: null as null | { keywords: string[]; description?: string }, jobThrows: false }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    jobApplication: { findFirst: vi.fn(async () => db.app) },
    jobMatch: { findFirst: vi.fn(async () => { if (db.jobThrows) throw new Error('relation "job_matches" does not exist'); return db.job ? { job: { description: 'desc', ...db.job } } : null }) },
  },
}))
import { savedJobKeywords } from '@/lib/job-keywords'

const five = ['a', 'b', 'c', 'd', 'e']
describe('savedJobKeywords', () => {
  beforeEach(() => Object.assign(db, { app: null, job: null, jobThrows: false }))
  it('prefers their own last tailor of the post', async () => {
    db.app = { keywords: five }
    db.job = { keywords: ['x', 'y', 'z', 'w', 'v'] }
    expect(await savedJobKeywords('u', 'desc', 'm1')).toEqual(five)
  })
  it('falls back to the job behind their match, so the % stays the same', async () => {
    db.job = { keywords: five }
    expect(await savedJobKeywords('u', 'desc', 'm1')).toEqual(five)
    expect(await savedJobKeywords('u', 'desc')).toBeNull()
  })
  it('ignores the match once the text was edited on the Job card', async () => {
    db.job = { keywords: five, description: 'the original post' }
    expect(await savedJobKeywords('u', 'desc', 'm1')).toBeNull()
  })
  it('returns null for short lists, empty text, or no feed tables', async () => {
    db.job = { keywords: ['a'] }
    expect(await savedJobKeywords('u', 'desc', 'm1')).toBeNull()
    expect(await savedJobKeywords('u', '  ', 'm1')).toBeNull()
    db.jobThrows = true
    expect(await savedJobKeywords('u', 'desc', 'm1')).toBeNull()
  })
})
