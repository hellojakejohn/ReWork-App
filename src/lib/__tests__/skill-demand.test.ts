import { describe, expect, it } from 'vitest'
import { skillDemand } from '@/lib/skill-demand'

const m = (score: number, ...missing: string[]) => ({ score, missing })

describe('skillDemand', () => {
  it('counts each skill once per job, case-insensitively, most jobs first', () => {
    const out = skillDemand([m(60, 'SQL', 'sql', 'Tableau'), m(50, 'SQL', 'Python'), m(40, 'sql', 'Python'), m(30, 'Go')])
    expect(out).toEqual([
      { skill: 'SQL', jobs: 3, of: 4 },
      { skill: 'Python', jobs: 2, of: 4 },
    ])
  })
  it('breaks ties toward closer matches and caps the list', () => {
    const out = skillDemand([m(90, 'A', 'B'), m(80, 'A', 'B'), m(20, 'C'), m(10, 'C')], 2)
    expect(out.map((d) => d.skill)).toEqual(['A', 'B'])
  })
  it('nothing for one-off gaps or no matches', () => {
    expect(skillDemand([m(50, 'SQL'), m(40, 'Go')])).toEqual([])
    expect(skillDemand([])).toEqual([])
  })
})
