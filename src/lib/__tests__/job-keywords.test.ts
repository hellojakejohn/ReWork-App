import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ app: null as null | { keywords: string[] }, job: null as null | { keywords: string[] }, jobThrows: false }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    jobApplication: { findFirst: vi.fn(async () => db.app) },
    job: { findFirst: vi.fn(async () => { if (db.jobThrows) throw new Error('relation "jobs" does not exist'); return db.job }) },
  },
}))
import { savedJobKeywords } from '@/lib/job-keywords'

const five = ['a', 'b', 'c', 'd', 'e']
describe('savedJobKeywords', () => {
  beforeEach(() => Object.assign(db, { app: null, job: null, jobThrows: false }))
  it('prefers their own last tailor of the post', async () => {
    db.app = { keywords: five }
    db.job = { keywords: ['x', 'y', 'z', 'w', 'v'] }
    expect(await savedJobKeywords('u', 'desc')).toEqual(five)
  })
  it('falls back to the shared job from their matches, so the % stays the same', async () => {
    db.job = { keywords: five }
    expect(await savedJobKeywords('u', 'desc')).toEqual(five)
  })
  it('returns null for short lists, empty text, or no feed tables', async () => {
    db.job = { keywords: ['a'] }
    expect(await savedJobKeywords('u', 'desc')).toBeNull()
    expect(await savedJobKeywords('u', '  ')).toBeNull()
    db.jobThrows = true
    expect(await savedJobKeywords('u', 'desc')).toBeNull()
  })
})
