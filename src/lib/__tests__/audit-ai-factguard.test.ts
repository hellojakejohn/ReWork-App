// Audit (launch-audit branch): adversarial tests for the tailor fact guard
// (src/lib/fact-guard.ts + src/lib/resume-text.ts). Each test swaps ONE bullet of a known
// master for a rewrite that invents something, then checks whether the guard kept it.
// `it.fails` = the invented claim slips through today; the comment says what should happen.
import { describe, expect, it } from 'vitest'
import { factGuard } from '@/lib/fact-guard'
import type { TailorInput, TailorOutput } from '@/types/tailor'

const master: TailorInput = {
  summary: 'Restaurant manager with 6 years of experience in busy kitchens.',
  roles: [
    {
      id: 'role_a',
      title: 'Restaurant Manager',
      company: 'Blue Door Bistro',
      startDate: '2019-03',
      endDate: 'present',
      location: 'Saint Paul, MN',
      bullets: [
        'Managed a team of 8 servers and cooks',
        'Grew catering revenue by 30% in one year',
        'Processed $1.2M in annual sales',
        'Ran 50 catering events a year',
        'Tracked food waste every week',
      ],
    },
  ],
  education: [{ id: 'edu_0', degree: 'BA', field: 'Hospitality', institution: 'Metro State', graduationYear: '2018', details: [] }],
  projects: [],
  skills: ['Excel', 'Scheduling', 'Inventory'],
  skillGroups: [{ group: '', items: ['Excel', 'Scheduling', 'Inventory'] }],
  certifications: [],
}

const baseOutput = (): TailorOutput => ({
  targetKeywords: [],
  summary: master.summary,
  roles: master.roles.map((r) => ({
    id: r.id,
    title: r.title,
    company: r.company,
    startDate: r.startDate,
    endDate: r.endDate,
    bullets: r.bullets.map((text) => ({ text, reason: 'x' })),
  })),
  education: master.education.map((e) => ({ id: e.id, degree: e.degree, institution: e.institution, graduationYear: e.graduationYear })),
  projects: [],
  skills: [...master.skills],
})

/** Replace bullet `index` of role_a with `text`; true when the guard kept `text`. */
function survives(text: string, index = 4, input: TailorInput = master): boolean {
  const out = baseOutput()
  out.roles[0].bullets[index] = { text, reason: 'tailored' }
  const { cleaned } = factGuard(input, out)
  return cleaned.roles[0].bullets.some((b) => b.text === text)
}

describe('fact guard: things it catches (baseline)', () => {
  it('new digit metric: "team of 12" when the resume says 8', () => {
    expect(survives('Managed a team of 12 servers and cooks', 0)).toBe(false)
  })
  it('k suffix: "8K guests" is 8000, not 8', () => {
    expect(survives('Served 8K guests a month')).toBe(false)
    expect(survives('Served 40k guests a month')).toBe(false)
  })
  it('$1.2M and 1,200,000 compare equal (same fact allowed)', () => {
    expect(survives('Processed 1,200,000 dollars in annual sales', 2)).toBe(true)
  })
  it('a different magnitude: "$30M" is not the "30%" in the resume', () => {
    expect(survives('Processed $30M in annual sales', 2)).toBe(false)
  })
  it('percent vs plain: "8%" is not the "8" team size', () => {
    expect(survives('Cut food waste by 8%')).toBe(false)
  })
  it('multiplier: "6x" is not the "6" years', () => {
    expect(survives('Cut ticket times 6x')).toBe(false)
  })
  it('company, title and dates changed by the model are restored', () => {
    const out = baseOutput()
    Object.assign(out.roles[0], { company: 'Olive Garden', title: 'General Manager', startDate: '2015-01' })
    const { cleaned } = factGuard(master, out)
    expect(cleaned.roles[0]).toMatchObject({ company: 'Blue Door Bistro', title: 'Restaurant Manager', startDate: '2019-03' })
  })
  it('an invented role is discarded; an invented skill is dropped from the skills list', () => {
    const out = baseOutput()
    out.roles.push({ id: 'role_x', title: 'GM', company: 'Sysco', startDate: '2015', endDate: '2016', bullets: [] })
    out.skills.push('Tableau')
    const { cleaned } = factGuard(master, out)
    expect(cleaned.roles.map((r) => r.id)).toEqual(['role_a'])
    expect(cleaned.skills).not.toContain('Tableau')
  })
})

describe('fact guard: numbers written as words', () => {
  // Should revert: "doubled" is a 2x claim the resume never makes.
  it.fails('"Doubled catering revenue" (no digits) is reverted', () => {
    expect(survives('Doubled catering revenue in one year')).toBe(false)
  })
  // Should revert: 20% is not in the resume; the tailor guard has no word-number check
  // (text-facts.ts has one for cover letters, fact-guard.ts does not use it).
  it.fails('"twenty percent" is reverted', () => {
    expect(survives('Grew repeat bookings by twenty percent')).toBe(false)
  })
  // Should revert: a 3x speed claim.
  it.fails('"three times faster" is reverted', () => {
    expect(survives('Turned tables three times faster than the area average')).toBe(false)
  })
  // Should revert: "tripled" / "halved" are metrics too.
  it.fails('"Halved food waste" is reverted', () => {
    expect(survives('Halved food waste through weekly tracking')).toBe(false)
  })
})

describe('fact guard: magnitude words and suffixes', () => {
  // Should revert: "$8 million" is a new claim; today the word "million" is ignored and the
  // token is just "8", which the team size whitelists.
  it.fails('"$8 million" borrowing the "8" from the team size is reverted', () => {
    expect(survives('Oversaw $8 million in purchasing')).toBe(false)
  })
  it.fails('"50 thousand guests" borrowing the "50" from events is reverted', () => {
    expect(survives('Served 50 thousand guests a year')).toBe(false)
  })
  // Should be ALLOWED (same fact as $1.2M). Today it's reverted: a false positive, safe
  // direction, costs a good rewrite.
  it.fails('"$1.2 million" is accepted as the same fact as "$1.2M"', () => {
    expect(survives('Processed $1.2 million in annual sales', 2)).toBe(true)
  })
  // Should revert: unicode multiplication sign is a 6x claim.
  it.fails('"6×" (unicode times sign) is treated like "6x"', () => {
    expect(survives('Cut ticket times 6×')).toBe(false)
  })
})

describe('fact guard: cross-bullet borrowing (numbers are checked against the WHOLE resume)', () => {
  // Should revert: 30% belongs to catering revenue, not labor cost.
  it.fails('"Cut labor costs by 30%" (30% belongs to another bullet) is reverted', () => {
    expect(survives('Cut labor costs by 30% with smarter scheduling', 0)).toBe(false)
  })
  // Should revert: "6" is years of experience, not a team size.
  it.fails('"team of 6" (6 is years of experience) is reverted', () => {
    expect(survives('Led a team of 6 line cooks')).toBe(false)
  })
  // Should revert: 2018 is the graduation year.
  it.fails('"2018 covers a week" (2018 is the graduation year) is reverted', () => {
    expect(survives('Served 2018 covers a week')).toBe(false)
  })
  // Range built from two numbers that exist elsewhere: slips too.
  it.fails('"teams of 6-8" is reverted', () => {
    expect(survives('Led teams of 6-8 across two locations', 0)).toBe(false)
  })
  // The tailor prompt says evidence numbers may be used "in the bullet they're about, and
  // nowhere else", but evidence is merged into the global number set.
  it.fails('an evidence number moved to a different bullet is reverted', () => {
    const withEvidence: TailorInput = { ...master, evidence: ['Cut food waste 15% (bullet: Tracked food waste every week)'] }
    expect(survives('Raised average check size by 15%', 1, withEvidence)).toBe(false)
  })
})

describe('fact guard: qualifiers, unicode digits', () => {
  // Should revert or flag: "over 50" / "50+" claims more than the resume.
  it.fails('"over 50 events" when the resume says "50 events" is flagged', () => {
    expect(survives('Ran over 50 catering events a year', 3)).toBe(false)
  })
  // Should revert: NUMBER_RE uses \d without the u flag, so fullwidth / Arabic-Indic digits
  // are invisible to the guard.
  it.fails('fullwidth digits "９０%" are checked', () => {
    expect(survives('Cut food waste by ９０%')).toBe(false)
  })
  it.fails('Arabic-Indic digits are checked', () => {
    expect(survives('Cut food waste by ٩٠%')).toBe(false)
  })
})

describe('fact guard: invented names inside bullet text (only the skills list is checked)', () => {
  it.fails('invented employer/partner in a bullet is reverted', () => {
    expect(survives('Negotiated supplier contracts with Sysco and US Foods')).toBe(false)
  })
  it.fails('invented title in a bullet is reverted', () => {
    expect(survives('Promoted to General Manager after the first year')).toBe(false)
  })
  it.fails('invented tool in a bullet is reverted', () => {
    expect(survives('Built weekly sales dashboards in Tableau')).toBe(false)
  })
  it.fails('invented certification in a bullet is reverted', () => {
    expect(survives('ServSafe Manager certified; trained staff on HACCP')).toBe(false)
  })
  it.fails('an extra, fully invented bullet (no numbers) is not added', () => {
    const out = baseOutput()
    out.roles[0].bullets.push({ text: 'Opened a second location in Minneapolis', reason: 'x' })
    const { cleaned } = factGuard(master, out)
    expect(cleaned.roles[0].bullets.map((b) => b.text)).not.toContain('Opened a second location in Minneapolis')
  })
})
