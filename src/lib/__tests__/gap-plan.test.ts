import { describe, expect, it, vi } from 'vitest'
import { buildGapPrompt, cleanGapPlans, cleanSkills, gapKey, gapLinks, gapPlans, wrapAffiliate, type GapPlan } from '@/lib/gap-plan'

const plan = (skill: string, over: Partial<GapPlan> = {}): GapPlan => ({
  skill,
  closeable: true,
  time: '2 to 3 weeks',
  learn: 'A beginner course on joins and grouping.',
  build: 'Query a public dataset.',
  addAs: 'Courses: SQL (online)',
  query: 'sql for beginners',
  ...over,
})

describe('cleanSkills', () => {
  it('dedupes by key, trims and caps at 8', () => {
    expect(cleanSkills([' SQL ', 'sql', 'Tableau', 5, ''])).toEqual(['SQL', 'Tableau'])
    expect(cleanSkills(Array.from({ length: 12 }, (_, i) => `s${i}`))).toHaveLength(8)
    expect(cleanSkills('SQL')).toEqual([])
  })
  it('gapKey ignores case and spacing', () => {
    expect(gapKey('  Power   BI ')).toBe(gapKey('power bi'))
  })
})

describe('cleanGapPlans', () => {
  it('keeps only asked skills, strips links and em-dashes, blanks build for non-closeable', () => {
    const out = cleanGapPlans(
      {
        plans: [
          plan('sql', { learn: 'Take one — see https://example.com/course now' }),
          plan('Rust'),
          plan('5+ years experience', { closeable: false, build: 'x', addAs: 'y' }),
        ],
      },
      ['SQL', '5+ years experience']
    )
    expect(out.map((p) => p.skill)).toEqual(['SQL', '5+ years experience'])
    expect(out[0].learn).not.toMatch(/http|—/)
    expect(out[1]).toMatchObject({ closeable: false, build: '', addAs: '' })
  })
  it('drops plans with no time or learn, and junk', () => {
    expect(cleanGapPlans({ plans: [plan('SQL', { time: '' })] }, ['SQL'])).toEqual([])
    expect(cleanGapPlans(null, ['SQL'])).toEqual([])
  })
  it('the prompt never asks for links or names', () => {
    expect(buildGapPrompt(['SQL'])).toContain('- SQL')
  })
})

describe('links', () => {
  it('plain search links without a template', () => {
    const links = gapLinks(plan('SQL'), {})
    expect(links.map((l) => l.label)).toEqual(['Coursera', 'Udemy', 'YouTube'])
    expect(links.every((l) => !l.partner)).toBe(true)
    expect(links[0].href).toBe('https://www.coursera.org/search?query=sql%20for%20beginners')
  })
  it('wraps a partner link when its template is set', () => {
    const links = gapLinks(plan('SQL'), { AFFILIATE_COURSERA: 'https://aff.example/c/1?u={url}' })
    expect(links[0]).toMatchObject({ partner: true })
    expect(links[0].href).toBe(`https://aff.example/c/1?u=${encodeURIComponent('https://www.coursera.org/search?query=sql%20for%20beginners')}`)
    expect(links[1].partner).toBe(false)
  })
  it('ignores a bad template', () => {
    expect(wrapAffiliate('https://x', 'http://aff/{url}')).toBeNull()
    expect(wrapAffiliate('https://x', 'https://aff/no-placeholder')).toBeNull()
  })
  it('no links for things a course cannot close', () => {
    expect(gapLinks(plan('Clearance', { closeable: false }), {})).toEqual([])
  })
})

describe('gapPlans cache', () => {
  const db = () => ({
    skillGap: {
      findMany: vi.fn(async () => [{ key: 'sql', plan: plan('sql') }]),
      createMany: vi.fn(async () => ({})),
    },
  })
  it('uses the cache and only generates the rest, in the asked order', async () => {
    const d = db()
    const gen = vi.fn(async (m: string[]) => m.map((s) => plan(s)))
    const out = await gapPlans(d, ['Tableau', 'SQL'], gen)
    expect(gen).toHaveBeenCalledWith(['Tableau'])
    expect(out.generated).toBe(1)
    expect(out.plans.map((p) => p.skill)).toEqual(['Tableau', 'SQL'])
    expect(d.skillGap.createMany).toHaveBeenCalledTimes(1)
  })
  it('no model call when everything is cached', async () => {
    const gen = vi.fn(async () => [])
    const out = await gapPlans(db(), ['sql'], gen)
    expect(gen).not.toHaveBeenCalled()
    expect(out.plans).toHaveLength(1)
  })
  it('works before the table exists', async () => {
    const d = db()
    d.skillGap.findMany.mockRejectedValue(new Error('relation "skill_gaps" does not exist'))
    d.skillGap.createMany.mockRejectedValue(new Error('relation "skill_gaps" does not exist'))
    const out = await gapPlans(d, ['SQL'], async (m) => m.map((s) => plan(s)))
    expect(out.plans).toHaveLength(1)
  })
})
