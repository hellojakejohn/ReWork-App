import { describe, expect, it } from 'vitest'
import { dedupeJobs, parseBoardList, roleKey, workdayLocation } from '@/lib/feed/boards'
import { isRemote, locationCountry, prescore, resumeProfile, titleFit, titleRelevant, titleWords, usState } from '@/lib/feed/prefilter'
import type { ParsedResume } from '@/types/parsed-resume'

const body = 'Build the checkout UI in React and TypeScript. You will work with design on our component library. '.repeat(3)

describe('parseBoardList', () => {
  it('reads a Greenhouse list like a single job', () => {
    const jobs = parseBoardList({ ats: 'greenhouse', slug: 'acme' }, {
      jobs: [
        { id: 11, title: 'Frontend Engineer', absolute_url: 'https://boards.greenhouse.io/acme/jobs/11', location: { name: 'Remote - US' }, content: `&lt;p&gt;${body}&lt;/p&gt;`, first_published: '2026-11-01T00:00:00Z' },
        { id: 12, title: 'Too short', absolute_url: 'x', location: { name: '' }, content: 'hi' },
      ],
    })
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({ key: 'greenhouse:acme:11', title: 'Frontend Engineer', location: 'Remote - US', source: 'greenhouse' })
    expect(jobs[0].description).toContain('checkout UI')
  })
  it('reads Lever and Ashby lists, skipping unlisted Ashby jobs', () => {
    const lever = parseBoardList({ ats: 'lever', slug: 'acme' }, [{ id: 'a-1', text: 'Ops Associate', hostedUrl: 'u', categories: { location: 'Minneapolis, MN' }, descriptionPlain: body, description: `<p>${body}</p>` }])
    expect(lever[0]).toMatchObject({ key: 'lever:acme:a-1', title: 'Ops Associate' })
    const ashby = parseBoardList({ ats: 'ashby', slug: 'acme' }, {
      jobs: [
        { id: 'b-1', title: 'Engineer', location: 'New York', isRemote: true, jobUrl: 'u', descriptionPlain: body, isListed: true },
        { id: 'b-2', title: 'Hidden', location: 'New York', jobUrl: 'u', descriptionPlain: body, isListed: false },
      ],
    })
    expect(ashby.map((j) => j.title)).toEqual(['Engineer'])
    expect(ashby[0].location).toMatch(/Remote/)
  })
})

describe('dedupe', () => {
  it('drops exact repeats and collapses one role across cities', () => {
    const a = { company: 'Sweetgreen', title: 'Restaurant General Manager', location: 'Denver, CO' }
    expect(dedupeJobs([a, { ...a }, { ...a, location: 'Dallas, TX' }])).toHaveLength(2)
    expect(roleKey({ company: 'X', title: 'Web Developer (New York, NY)' })).toBe(roleKey({ company: 'X', title: 'Web Developer' }))
    expect(roleKey({ company: 'X', title: 'Web Developer' })).not.toBe(roleKey({ company: 'X', title: 'Backend Developer' }))
  })
})

describe('locations', () => {
  it('finds the US state, remote and non-US places', () => {
    expect(usState('Saint Paul, MN')).toBe('MN')
    expect(usState('Costa Mesa, California, United States')).toBe('CA')
    expect(usState('Washington, D.C.')).toBe('DC')
    expect(usState('San Francisco')).toBe('CA')
    expect(isRemote('Remote - United States')).toBe(true)
    expect(locationCountry('Remote - US')).toBe('us')
    // Workday styles (Nov 9 check: these were read as other countries).
    expect(usState('MN - St. Paul')).toBe('MN')
    expect(usState('MO-ST. LOUIS, 100 S 4TH ST')).toBe('MO')
    expect(usState('SD, Sioux Falls')).toBe('SD')
    expect(usState('USA - Hutchinson KS 67501')).toBe('KS')
    expect(usState('ON, Mississauga')).toBe(null)
    expect(usState('LON - London')).toBe(null)
    expect(locationCountry('AL - Birmingham')).toBe('us')
    expect(locationCountry('3 Locations')).toBe('unknown')
    expect(locationCountry('CAN, ON, Mississauga')).toBe('other')
    expect(locationCountry('Remote')).toBe('unknown')
    expect(locationCountry('Warsaw')).toBe('other')
    expect(locationCountry('Gurugram')).toBe('other')
    expect(locationCountry('Remote, Canada; Remote, United States')).toBe('us')
  })
})

const resume = (titles: string[], skills: string[], start = '2021-01'): ParsedResume => ({
  contact: { fullName: 'A B', headline: '', email: '', phone: '', location: 'Saint Paul, MN', links: [] },
  summary: '',
  skills: [{ group: '', items: skills }],
  experience: titles.map((title, i) => ({ id: `e${i}`, title, company: 'C', location: '', startDate: start, endDate: i === 0 ? 'present' : '2020-12', current: i === 0, bullets: [] })),
  projects: [],
  education: [],
  certifications: [],
  extraSections: [],
})

describe('prescore', () => {
  const dev = resumeProfile(resume(['Frontend Developer'], ['React', 'TypeScript', 'CSS'], '2023-06'))
  it('ranks a matching title with the skills above an unrelated job', () => {
    const fit = prescore({ title: 'Frontend Engineer', location: 'Remote - US', description: body }, dev)
    const other = prescore({ title: 'Account Executive', location: 'Remote - US', description: 'Sell to enterprise buyers and close deals.' }, dev)
    expect(fit.score).toBeGreaterThan(70)
    expect(fit.skillHits).toEqual(expect.arrayContaining(['React', 'TypeScript']))
    expect(other.score).toBeLessThan(20)
  })
  it('marks senior titles down for a short career, and drops non-US and far on-site jobs', () => {
    const plain = prescore({ title: 'Frontend Engineer', location: 'Remote - US', description: body }, dev)
    const senior = prescore({ title: 'Staff Frontend Engineer', location: 'Remote - US', description: body }, dev)
    expect(senior.score).toBeLessThan(plain.score)
    expect(prescore({ title: 'Frontend Engineer', location: 'Berlin', description: body }, dev).dropped).toBe('outside the US')
    const prefs = { onsiteNearHomeOnly: true }
    expect(prescore({ title: 'Frontend Engineer', location: 'Austin, TX', description: body }, dev, prefs).dropped).toBe('on-site, not near home')
    expect(prescore({ title: 'Frontend Engineer', location: 'Minneapolis, MN', description: body }, dev, prefs).dropped).toBeNull()
  })
  it('uses target titles for a career change, and keeps General Manager whole', () => {
    expect(titleWords('Restaurant General Manager')).toEqual(['restaurant', 'gm'])
    const gm = resume(['General Manager'], ['Excel'])
    const job = { title: 'Operations Coordinator', location: 'Remote - US', description: 'Coordinate vendors and schedules in Excel. '.repeat(3) }
    expect(prescore(job, resumeProfile(gm)).title).toBe(0)
    const target = { targetTitles: ['Operations Coordinator'] }
    expect(prescore(job, resumeProfile(gm, target), target).title).toBe(100)
    expect(prescore({ ...job, title: 'Associate General Counsel' }, resumeProfile(gm)).title).toBe(0)
  })
})

describe('titleFit', () => {
  const profile = resumeProfile(
    { contact: { fullName: '', headline: '', email: '', phone: '', location: '', links: [] }, summary: '', skills: [], experience: [], projects: [], education: [], certifications: [], extraSections: [] },
    { targetTitles: ['Operations Coordinator', 'Frontend Developer'] }
  )
  it('is how much of a wanted title the job title covers', () => {
    expect(titleFit('Operations Work Coordinator - St Paul', profile)).toBe(100)
    expect(titleFit('Cyber Operations Lead, Critical Harm Operations', profile)).toBe(50)
    expect(titleFit('Senior Operations Associate', profile)).toBe(50)
    expect(titleFit('Front End Developer', profile)).toBe(100)
    expect(titleFit('Account Executive', profile)).toBe(0)
  })
})

describe('workdayLocation', () => {
  const b = { company: 'X', tenant: 'x', host: 'x.wd1.myworkdayjobs.com', site: 'S' }
  it('reads the main place from the link when the text says "N Locations"', () => {
    const loc = workdayLocation(b, '9 Locations', '/job/Mounds-View-Minnesota-United-States-of-America/Engineer_R1')
    expect(loc).toBe('Mounds View Minnesota United States of America (and more)')
    expect(usState(loc)).toBe('MN')
    expect(usState(workdayLocation(b, '', '/job/TX---Houston/Analyst_R2'))).toBe('TX')
    expect(usState(workdayLocation(b, '2 Locations', '/job/Seattle-WA-USA/PM_R3'))).toBe('WA')
    expect(workdayLocation(b, 'Saint Paul, MN', '/job/x/y')).toBe('Saint Paul, MN')
  })
  it('adds the state for one-state employers that list sites by name', () => {
    const loc = workdayLocation({ ...b, state: 'MN' }, 'Abbott Northwestern Hospital', '/job/Abbott-Northwestern-Hospital/RN_R4')
    expect(usState(loc)).toBe('MN')
  })
})

describe('titleRelevant', () => {
  const p = (titles: string[]) => resumeProfile({ contact: { location: 'Saint Paul, MN' }, experience: [], skills: [], projects: [], education: [] } as never, { targetTitles: titles })
  it('needs a field word, not just the role word', () => {
    expect(titleRelevant('Recruiting Coordinator', p(['Logistics Coordinator']))).toBe(false)
    expect(titleRelevant('Senior Logistics Coordinator', p(['Logistics Coordinator']))).toBe(true)
    expect(titleRelevant('Care Coordinator RN', p(['RN Care Coordinator']))).toBe(true)
    expect(titleRelevant('Registered Nurse - Med Surg', p(['RN Care Coordinator']))).toBe(true)
    expect(titleRelevant('Recruiting Coordinator', p(['RN Care Coordinator']))).toBe(false)
    expect(titleRelevant('Lifecycle Marketing Coordinator', p(['Marketing Coordinator']))).toBe(true)
  })
  it('keeps role-only titles and tech titles working', () => {
    expect(titleRelevant('Lead Accountant', p(['Senior Accountant']))).toBe(true)
    expect(titleRelevant('Backend Engineer', p(['Software Engineer']))).toBe(true)
    expect(titleRelevant('Customer Success Account Manager', p(['Customer Success Manager']))).toBe(true)
    expect(titleRelevant('Executive Assistant to the CEO', p(['Executive Assistant']))).toBe(true)
  })
})

describe('titleRelevant for designers', () => {
  const p = (titles: string[]) => resumeProfile({ contact: { location: 'Saint Paul, MN' }, experience: [], skills: [], projects: [], education: [] } as never, { targetTitles: titles })
  it('keeps design fields apart', () => {
    expect(titleRelevant('Senior Product Designer', p(['Instructional Designer']))).toBe(false)
    expect(titleRelevant('Senior Instructional Designer', p(['Instructional Designer']))).toBe(true)
    expect(titleRelevant('Product Designer', p(['UX Designer']))).toBe(true)
  })
  it('needs the same role when both titles name one', () => {
    expect(titleRelevant('Product Designer', p(['Product Manager']))).toBe(false)
    expect(titleRelevant('Senior Product Manager', p(['Product Manager']))).toBe(true)
    expect(titleRelevant('Product Manager', p(['UI Engineer']))).toBe(false)
  })
})

describe('workdayLocation, home as remote', () => {
  it('reads "Home" as Remote', () => {
    const b = { company: 'Prime Therapeutics', tenant: 'primetherapeutics', host: 'x', site: 'y' }
    expect(workdayLocation(b, 'Home', '/job/Home/Analyst_R1')).toBe('Remote')
    expect(isRemote(workdayLocation(b, 'Home', '/job/Home/Analyst_R1'), '')).toBe(true)
  })
})
