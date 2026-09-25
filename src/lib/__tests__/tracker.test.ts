import { describe, expect, it } from 'vitest'
import { columnOf, startOfWeek, trackerStats, transitionPatch, type TrackedState } from '@/lib/tracker'

const now = new Date('2026-09-25T15:00:00') // a Friday, local time
const tailored: TrackedState = { status: 'OPTIMIZED', tailored: true, appliedAt: null, responseAt: null }

describe('columns', () => {
  it('maps the enum to user-facing columns', () => {
    expect(columnOf('DRAFT')).toBe('saved')
    expect(columnOf('OPTIMIZED')).toBe('saved')
    expect(columnOf('APPLIED')).toBe('applied')
    expect(columnOf('INTERVIEW')).toBe('interview')
    expect(columnOf('OFFER')).toBe('offer')
    expect(columnOf('REJECTED')).toBe('rejected')
  })
})

describe('transitionPatch', () => {
  it('sets appliedAt when a card moves to Applied', () => {
    expect(transitionPatch(tailored, 'applied', now)).toEqual({ status: 'APPLIED', statusUpdatedAt: now, appliedAt: now })
  })

  it('sets responseAt (and appliedAt, if skipped) when it hears back', () => {
    expect(transitionPatch(tailored, 'interview', now)).toEqual({ status: 'INTERVIEW', statusUpdatedAt: now, appliedAt: now, responseAt: now })
    const applied = { ...tailored, status: 'APPLIED' as const, appliedAt: new Date('2026-09-01') }
    expect(transitionPatch(applied, 'rejected', now)).toEqual({ status: 'REJECTED', statusUpdatedAt: now, responseAt: now })
  })

  it('never erases dates when moving back, and Saved restores tailored vs tracked', () => {
    const interviewing: TrackedState = { status: 'INTERVIEW', tailored: true, appliedAt: new Date('2026-09-01'), responseAt: new Date('2026-09-10') }
    expect(transitionPatch(interviewing, 'applied', now)).toEqual({ status: 'APPLIED', statusUpdatedAt: now })
    expect(transitionPatch(interviewing, 'saved', now)).toEqual({ status: 'OPTIMIZED', statusUpdatedAt: now })
    expect(transitionPatch({ ...interviewing, tailored: false }, 'saved', now)?.status).toBe('DRAFT')
  })

  it('is a no-op within the same column (DRAFT and OPTIMIZED are both Saved)', () => {
    expect(transitionPatch(tailored, 'saved', now)).toBeNull()
    expect(transitionPatch({ ...tailored, status: 'DRAFT', tailored: false }, 'saved', now)).toBeNull()
  })
})

describe('trackerStats', () => {
  it('counts applied this week (from Monday), interviews and response rate', () => {
    expect(startOfWeek(now).getDay()).toBe(1)
    const stats = trackerStats(
      [
        { status: 'OPTIMIZED', appliedAt: null },
        { status: 'APPLIED', appliedAt: new Date('2026-09-22T10:00:00') }, // Monday this week
        { status: 'APPLIED', appliedAt: new Date('2026-09-19T10:00:00') }, // last week
        { status: 'INTERVIEW', appliedAt: new Date('2026-09-24T10:00:00') },
        { status: 'OFFER', appliedAt: new Date('2026-08-01T10:00:00') },
        { status: 'REJECTED', appliedAt: new Date('2026-08-02T10:00:00') },
      ],
      now
    )
    expect(stats).toEqual({ appliedThisWeek: 2, interviews: 2, applied: 5, responseRate: 60 })
  })

  it('has no response rate before anything is applied to', () => {
    expect(trackerStats([{ status: 'DRAFT', appliedAt: null }], now).responseRate).toBeNull()
  })
})
