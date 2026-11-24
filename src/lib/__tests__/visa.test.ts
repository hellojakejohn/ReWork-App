import { describe, expect, it } from 'vitest'
import { employerKey, employerKeys, h1bRecord } from '@/lib/visa/h1b'
import { postSponsorship } from '@/lib/visa/post-sponsorship'

describe('employerKey', () => {
  it('matches a legal filing name to the name on a job board', () => {
    expect(employerKey('AMAZON.COM SERVICES LLC')).toBe(employerKey('Amazon'))
    expect(employerKey('GOOGLE LLC')).toBe('google')
    expect(employerKey('Microsoft Corporation')).toBe('microsoft')
    expect(employerKey('The Home Depot, Inc.')).toBe('home depot')
    expect(employerKey('STRIPE, INC.')).toBe('stripe')
    expect(employerKey('Ernst & Young U.S. LLP')).toBe(employerKey('Ernst and Young'))
    expect(employerKey('JPMORGAN CHASE BANK, N.A.')).toBe('jpmorgan chase bank')
  })
  it('keeps a name that is only generic words', () => {
    expect(employerKey('Global Services LLC')).toBe('global services')
    expect(employerKey('Bank of America')).toBe('bank of america')
  })
  it('reads the trade name after DBA too', () => {
    expect(employerKeys('Baristas Incorporated DBA Coffee First')).toEqual(['baristas', 'coffee first'])
  })
})

describe('h1bRecord', () => {
  const d = { years: 'FY2021-FY2023', employers: { google: 9000, stripe: 120 } }
  it('gives approvals, 0 when none on record, null before the data is built', () => {
    expect(h1bRecord('Google', d)).toEqual({ approvals: 9000, years: 'FY2021-FY2023' })
    expect(h1bRecord('Stripe, Inc.', d)?.approvals).toBe(120)
    expect(h1bRecord('Tiny Bakery', d)?.approvals).toBe(0)
    expect(h1bRecord('Google', { years: '', employers: {} })).toBeNull()
    expect(h1bRecord(' ', d)).toBeNull()
  })
})

describe('postSponsorship', () => {
  it('reads a post that rules sponsorship out', () => {
    for (const t of [
      'We are unable to sponsor visas for this role.',
      'This position is not eligible for visa sponsorship.',
      'Applicants must be authorized to work in the US without the need for current or future sponsorship.',
      'Visa sponsorship is not available.',
      'We do not offer H-1B sponsorship at this time.',
      'No visa sponsorship.',
      'The company will not provide sponsorship for employment visa status now or in the future.',
    ]) expect(postSponsorship(t), t).toBe('no')
  })
  it('reads a post that offers it', () => {
    expect(postSponsorship('Visa sponsorship is available for the right candidate.')).toBe('yes')
    expect(postSponsorship('We offer H-1B sponsorship.')).toBe('yes')
    expect(postSponsorship('ACME will sponsor qualified candidates.')).toBe('yes')
  })
  it('says nothing when the post says nothing, and "no" wins over "yes"', () => {
    expect(postSponsorship('Great benefits, remote friendly.')).toBeNull()
    expect(postSponsorship('')).toBeNull()
    expect(postSponsorship('Sponsorship is available for some roles. This role: no visa sponsorship.')).toBe('no')
  })
})

describe('build-h1b', () => {
  it('reads archive CSVs and hub exports by column name, summing approvals per employer', async () => {
    const { addCsv, yearsLabel } = await import('../../../scripts/build-h1b')
    const counts = { years: new Set<number>(), employers: new Map<string, number>() }
    addCsv(
      'Fiscal Year,Employer (Petitioner) Name,Tax ID,Initial Approval,Initial Denial,Continuing Approval,Continuing Denial\n' +
        '2023,"GOOGLE LLC",1234,"1,200",5,800,2\n2023,"AMAZON.COM SERVICES LLC",9,10,0,5,0\n2023,"Nobody Inc",1,0,3,0,0\n',
      counts
    )
    addCsv('﻿Fiscal Year\tEmployer\tNew Employment Approval\tContinuation Approval\n2025\tGoogle, Inc.\t100\t0\n', counts)
    expect(counts.employers.get('google')).toBe(2100)
    expect(counts.employers.get('amazon')).toBe(15)
    expect(counts.employers.has('nobody')).toBe(false)
    expect(yearsLabel(counts.years)).toBe('FY2023-FY2025')
    expect(() => addCsv('a,b\n1,2', counts)).toThrow(/no employer/)
  })
})

describe('rulesOutSponsor', () => {
  it('hides a "no" post and a no-record employer, keeps a "yes" post and unknowns', async () => {
    const { rulesOutSponsor } = await import('@/components/flow/matches-panel')
    const v = (post: 'no' | 'yes' | null, approvals: number | null) => ({ visa: { post, h1b: approvals === null ? null : { approvals, years: 'FY2023' } } })
    expect(rulesOutSponsor(v('no', 500))).toBe(true)
    expect(rulesOutSponsor(v('yes', 0))).toBe(false)
    expect(rulesOutSponsor(v(null, 0))).toBe(true)
    expect(rulesOutSponsor(v(null, 12))).toBe(false)
    expect(rulesOutSponsor(v(null, null))).toBe(false)
    expect(rulesOutSponsor({ visa: undefined })).toBe(false)
  })
})
