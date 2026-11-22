import { describe, expect, it } from 'vitest'
import { MIN_SKILL_JOBS, ROLES, money, roleBySlug, summarizeRole, titleInRole, topSkills, type RoleJob } from '@/lib/role-pages'

const job = (over: Partial<RoleJob> = {}): RoleJob => ({
  id: 'j1',
  title: 'Operations Coordinator',
  company: 'Acme',
  location: 'Saint Paul, MN',
  remote: false,
  usState: 'MN',
  payLabel: null,
  postedAt: null,
  firstSeenAt: new Date('2026-11-01'),
  url: `https://x/${Math.random()}`,
  ...over,
})

describe('role pages', () => {
  it('slugs are unique and look like slugs', () => {
    const slugs = ROLES.map((r) => r.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('matches titles to roles, with exclusions', () => {
    const ops = roleBySlug('operations-manager')!
    expect(titleInRole('Senior Operations Manager, Fulfillment', ops)).toBe(true)
    expect(titleInRole('Director of Operations Manager Programs', ops)).toBe(false)
    const store = roleBySlug('store-manager')!
    expect(titleInRole('Assistant Store Manager', store)).toBe(false)
    expect(titleInRole('Store Manager', store)).toBe(true)
    const rn = roleBySlug('registered-nurse')!
    expect(titleInRole('RN, Care Management', rn)).toBe(true)
    expect(titleInRole('Nurse Practitioner', rn)).toBe(false)
    expect(roleBySlug('nope')).toBeNull()
    const tech = roleBySlug('automotive-technician')!
    expect(titleInRole('Mechanical Design Engineer, Battery Pack', tech)).toBe(false)
    expect(titleInRole('Diesel Mechanic', tech)).toBe(true)
    expect(titleInRole('Western Region Sales', rn)).toBe(false)
    expect(titleInRole('Account Executive (SDR)', roleBySlug('sales-development-representative')!)).toBe(true)
  })

  it('summarizes counts, remote, pay medians, states, companies and newest', () => {
    const jobs = [
      job({ payLabel: '$50k to $60k a year', remote: true, usState: null, company: 'Acme', firstSeenAt: new Date('2026-11-20') }),
      job({ payLabel: '$60k to $70k a year', company: 'Acme' }),
      job({ payLabel: '$70k to $90k a year', company: 'Beta', usState: 'TX' }),
      job({ payLabel: '$22 to $25 an hour', company: 'Gamma' }),
      job({ company: 'Gamma', postedAt: new Date('2026-11-21') }),
    ]
    const s = summarizeRole(jobs, 2)
    expect(s.count).toBe(5)
    expect(s.remoteShare).toBeCloseTo(0.2)
    expect(s.payShare).toBeCloseTo(0.8)
    expect(s.yearly).toEqual({ low: 60000, high: 70000, n: 3 })
    expect(s.hourly).toBeNull() // fewer than 3
    expect(s.topStates[0]).toEqual({ state: 'Minnesota', n: 3 })
    expect(s.topCompanies.map((c) => c.company)).toEqual(['Acme', 'Gamma', 'Beta'])
    expect(s.newest.map((j) => j.postedAt ?? j.firstSeenAt)).toEqual([new Date('2026-11-21'), new Date('2026-11-20')])
    expect(s.employers).toBe(3)
  })

  it('shows at most 3 newest jobs per employer', () => {
    const many = Array.from({ length: 6 }, (_, i) => job({ company: "Domino's", firstSeenAt: new Date(2026, 10, 20 - i) }))
    const s = summarizeRole([...many, job({ company: 'Other', firstSeenAt: new Date(2026, 9, 1) })], 10)
    expect(s.newest.map((j) => j.company)).toEqual(["Domino's", "Domino's", "Domino's", 'Other'])
  })

  it('formats money', () => {
    expect(money(65000, 'year')).toBe('$65k')
    expect(money(22.5, 'hour')).toBe('$22.50')
    expect(money(25, 'hour')).toBe('$25')
  })
})

describe('role page skills', () => {
  it('lists nothing until enough jobs have keywords', () => {
    const few = Array.from({ length: MIN_SKILL_JOBS - 1 }, () => job({ keywords: ['Excel'] }))
    expect(topSkills(few).skills).toEqual([])
  })
  it('ranks skills by share of jobs, case-insensitive, once per job', () => {
    const jobs = [
      ...Array.from({ length: 8 }, () => job({ keywords: ['Excel', 'excel', 'Scheduling'] })),
      ...Array.from({ length: 4 }, () => job({ keywords: ['Scheduling', 'SAP'] })),
      job({ keywords: ['Rare'] }),
      job({ keywords: [] }),
    ]
    const { skills, jobs: n } = topSkills(jobs)
    expect(n).toBe(13)
    expect(skills.map((s) => s.skill)).toEqual(['Scheduling', 'Excel', 'SAP'])
    expect(skills[0].share).toBeCloseTo(12 / 13)
  })
  it('summary carries the skills and drops keywords from the newest list', () => {
    const jobs = Array.from({ length: 12 }, (_, i) => job({ id: `j${i}`, company: `C${i}`, url: `https://x/${i}`, keywords: ['Excel', 'Scheduling'] }))
    const s = summarizeRole(jobs)
    expect(s.topSkills.map((x) => x.skill)).toEqual(['Excel', 'Scheduling'])
    expect(s.skillJobs).toBe(12)
    expect(s.newest[0]).not.toHaveProperty('keywords')
    expect(s.newest[0].id).toBeDefined()
  })
})
