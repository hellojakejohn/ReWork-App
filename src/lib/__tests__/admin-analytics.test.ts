import { describe, expect, it } from 'vitest'
import { buildFunnel } from '@/lib/admin-analytics'

describe('buildFunnel', () => {
  it('computes conversion from the start and from the previous step', () => {
    const funnel = buildFunnel([
      { label: 'Signed up', users: 200 },
      { label: 'Parsed a resume', users: 150 },
      { label: 'Tailored', users: 90 },
      { label: 'Paid', users: 9 },
    ])
    expect(funnel.map((s) => [s.pctOfStart, s.pctOfPrevious])).toEqual([
      [100, 100],
      [75, 75],
      [45, 60],
      [4.5, 10],
    ])
  })

  it('has no percentages for an empty cohort', () => {
    expect(buildFunnel([{ label: 'Signed up', users: 0 }, { label: 'Paid', users: 0 }]).every((s) => s.pctOfStart === null)).toBe(true)
  })
})
