import { describe, expect, it } from 'vitest'
import { previousTailor } from '@/lib/previous-tailor'

const app = (id: string, over: Partial<{ resumeId: string; jobTitle: string; company: string; jobUrl: string | null; createdAt: string }> = {}) => ({
  id,
  resumeId: 'r1',
  jobTitle: 'Sr. Applications Developer',
  company: 'Trane',
  jobUrl: 'https://careers.tranetechnologies.com/job/92600058',
  createdAt: '2026-11-01T18:00:00Z',
  ...over,
})

describe('previousTailor', () => {
  it('finds the latest tailor of the same link, tracking ignored', () => {
    const apps = [app('old', { createdAt: '2026-10-01T00:00:00Z' }), app('new')]
    const job = { url: 'https://careers.tranetechnologies.com/job/92600058?utm_source=indeed&jdx_jid=1', title: 'Other title', company: 'Other' }
    expect(previousTailor(apps, 'r1', job)?.id).toBe('new')
  })
  it('matches a pasted job by title and company', () => {
    expect(previousTailor([app('a', { jobUrl: null })], 'r1', { url: '', title: 'Sr Applications Developer', company: 'trane' })?.id).toBe('a')
  })
  it('ignores another resume and another job', () => {
    expect(previousTailor([app('a', { resumeId: 'r2' })], 'r1', { url: '', title: 'Sr. Applications Developer', company: 'Trane' })).toBeNull()
    expect(previousTailor([app('a')], 'r1', { url: 'https://example.com/job/1', title: 'Designer', company: 'Trane' })).toBeNull()
    expect(previousTailor([app('a')], 'r1', { url: '', title: '', company: '' })).toBeNull()
  })
})

describe('previousTailor, loose title and company', () => {
  it('matches the Trane post read from its link against the pasted one', () => {
    const job = { url: 'https://careers.tranetechnologies.com/global/en/job/92600058/Sr-Applications-Developer-Full-Stack', title: 'Sr. Applications Developer (Full Stack)', company: 'trane technologies' }
    expect(previousTailor([app('a', { jobUrl: null })], 'r1', job)?.id).toBe('a')
    expect(previousTailor([app('a', { jobUrl: null, jobTitle: 'Sr. Applications Developer - Remote', company: 'Trane Technologies plc' })], 'r1', { url: '', title: 'Sr. Applications Developer', company: 'Trane' })?.id).toBe('a')
  })
  it('keeps different roles and companies apart', () => {
    expect(previousTailor([app('a', { jobUrl: null })], 'r1', { url: '', title: 'Applications Developer', company: 'Trane' })).toBeNull()
    expect(previousTailor([app('a', { jobUrl: null })], 'r1', { url: '', title: 'Sr. Applications Developer', company: 'Carrier' })).toBeNull()
  })
})
