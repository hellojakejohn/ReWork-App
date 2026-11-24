import { describe, expect, it } from 'vitest'
import { matchWhy } from '@/lib/feed/match-reasons'

const m = (present: string[], related: string[] = [], missing: string[] = []) => ({ present, related, missing })

describe('matchWhy', () => {
  it('names the title fit against the best wanted title', () => {
    expect(matchWhy('Operations Coordinator II', m([]), ['Office Manager', 'Operations Coordinator'], 4).title).toEqual({ fit: 'close', wanted: 'Operations Coordinator' })
    expect(matchWhy('Cyber Operations Lead', m([]), ['Operations Coordinator'], 4).title.fit).toBe('partly')
    expect(matchWhy('Registered Nurse', m([]), ['Operations Coordinator'], 4).title.fit).toBe('different')
  })

  it('counts key skills in its words, in other words, out of all', () => {
    expect(matchWhy('Analyst', m(['SQL', 'Excel'], ['Tableau'], ['Python', 'dbt']), ['Analyst'], 2).skills).toEqual({ have: 2, other: 1, of: 5 })
  })

  it('flags a senior title for fewer years and an entry title for more', () => {
    expect(matchWhy('Senior Engineer', m([]), ['Engineer'], 3).level).toEqual({ fits: false, note: 'Senior role, your resume shows 3 years' })
    expect(matchWhy('Senior Engineer', m([]), ['Engineer'], 7).level.fits).toBe(true)
    expect(matchWhy('Junior Engineer', m([]), ['Engineer'], 6).level).toEqual({ fits: false, note: 'Entry level, below your 6 years' })
    expect(matchWhy('Engineer', m([]), ['Engineer'], 1).level).toEqual({ fits: true, note: 'No level in the title' })
  })

  it('says "1 year", not "1 years"', () => {
    expect(matchWhy('Lead Barista', m([]), ['Barista'], 1).level.note).toBe('Senior role, your resume shows 1 year')
  })
})
