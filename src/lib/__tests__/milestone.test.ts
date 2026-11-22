import { describe, expect, it } from 'vitest'
import { milestoneFor } from '@/lib/tracker'

const app = (id: string, status: any) => ({ id, status, appliedAt: null }) // eslint-disable-line @typescript-eslint/no-explicit-any

describe('milestoneFor', () => {
  const apps = [app('a', 'APPLIED'), app('b', 'APPLIED'), app('c', 'INTERVIEW'), app('d', 'OPTIMIZED')]

  it('celebrates the second interview with counts after the move', () => {
    expect(milestoneFor(apps, apps[0], 'interview')).toEqual({ stage: 'interview', nth: 2, applied: 3, interviews: 2, offers: 0 })
  })

  it('counts a saved job moved straight to Interview as applied', () => {
    expect(milestoneFor(apps, apps[3], 'interview')).toMatchObject({ nth: 2, applied: 4 })
  })

  it('celebrates the first offer', () => {
    expect(milestoneFor(apps, apps[2], 'offer')).toEqual({ stage: 'offer', nth: 1, applied: 3, interviews: 1, offers: 1 })
  })

  it('stays quiet for moves back, to Applied or to Rejected', () => {
    expect(milestoneFor(apps, apps[2], 'applied')).toBeNull()
    expect(milestoneFor(apps, apps[0], 'rejected')).toBeNull()
    expect(milestoneFor([app('o', 'OFFER')], app('o', 'OFFER'), 'interview')).toBeNull()
  })
})
