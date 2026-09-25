import { describe, expect, it } from 'vitest'
import { factGuard } from '@/lib/fact-guard'
import { coverageReport } from '@/lib/keyword-coverage'
import { extractNumberTokens } from '@/lib/resume-text'
import { applyTailorOutput, buildTailorInput } from '@/lib/tailor'
import type { TailorInput, TailorOutput } from '@/types/tailor'

const master: TailorInput = {
  summary: 'Frontend developer with 3 years of experience building React apps.',
  roles: [
    {
      id: 'role_a',
      title: 'Frontend Developer',
      company: 'Acme Corp',
      startDate: '2022-01',
      endDate: 'present',
      location: 'Minneapolis, MN',
      bullets: [
        'Built a React dashboard used by 40 internal analysts',
        'Cut page load time by 30% by code-splitting routes',
        'Wrote unit tests with Jest for shared components',
      ],
    },
    {
      id: 'role_b',
      title: 'Web Intern',
      company: 'Beta LLC',
      startDate: '2021-05',
      endDate: '2021-08',
      location: 'Remote',
      bullets: ['Updated marketing pages in HTML and CSS'],
    },
  ],
  education: [
    {
      id: 'edu_a',
      degree: 'BS',
      field: 'Computer Science',
      institution: 'University of Minnesota',
      graduationYear: '2021',
      details: [],
    },
  ],
  projects: [
    {
      id: 'proj_a',
      name: 'Budget Tracker',
      description: 'Personal finance app in TypeScript',
      technologies: ['TypeScript', 'Next.js'],
      bullets: ['Shipped offline support with service workers'],
    },
  ],
  skills: ['React', 'JavaScript', 'TypeScript', 'Jest', 'CSS'],
}

// A faithful rewrite that should pass untouched.
function cleanOutput(): TailorOutput {
  return {
    targetKeywords: ['React', 'TypeScript', 'GraphQL', 'accessibility', 'Jest'],
    summary: 'React-focused frontend developer with 3 years of experience shipping internal tools.',
    roles: [
      {
        id: 'role_a',
        title: 'Frontend Developer',
        company: 'Acme Corp',
        startDate: '2022-01',
        endDate: 'present',
        bullets: [
          { text: 'Reduced page load time by 30% by code-splitting React routes', reason: 'Leads with performance' },
          { text: 'Built a React dashboard for 40 internal analysts', reason: 'Tightened wording' },
          { text: 'Tested shared components with Jest', reason: 'Matches testing requirement' },
        ],
      },
      {
        id: 'role_b',
        title: 'Web Intern',
        company: 'Beta LLC',
        startDate: '2021-05',
        endDate: '2021-08',
        bullets: [{ text: 'Maintained marketing pages in HTML and CSS', reason: 'Clearer verb' }],
      },
    ],
    education: [{ id: 'edu_a', degree: 'BS', institution: 'University of Minnesota', graduationYear: '2021' }],
    projects: [
      {
        id: 'proj_a',
        name: 'Budget Tracker',
        description: 'Personal finance app built in TypeScript',
        bullets: [{ text: 'Added offline support using service workers', reason: 'Clearer' }],
      },
    ],
    skills: ['React', 'TypeScript', 'Jest', 'JavaScript'],
  }
}

describe('factGuard', () => {
  it('passes a clean rewrite through with no warnings', () => {
    const output = cleanOutput()
    const { cleaned, warnings } = factGuard(master, output)
    expect(warnings).toEqual([])
    expect(cleaned.roles[0].bullets.map((b) => b.text)).toEqual(output.roles[0].bullets.map((b) => b.text))
    expect(cleaned.summary).toBe(output.summary)
    expect(cleaned.skills).toEqual(['React', 'TypeScript', 'Jest', 'JavaScript'])
  })

  it('restores a changed date and title', () => {
    const output = cleanOutput()
    output.roles[0].startDate = '2020-01'
    output.roles[0].title = 'Senior Frontend Engineer'
    const { cleaned, warnings } = factGuard(master, output)
    expect(cleaned.roles[0].startDate).toBe('2022-01')
    expect(cleaned.roles[0].title).toBe('Frontend Developer')
    expect(warnings.filter((w) => w.type === 'fact_restored')).toHaveLength(2)
  })

  it('discards an invented employer and restores a dropped one', () => {
    const output = cleanOutput()
    output.roles[1] = {
      id: 'role_x',
      title: 'Senior React Engineer',
      company: 'Google',
      startDate: '2019-01',
      endDate: '2020-12',
      bullets: [{ text: 'Led the React migration', reason: 'Relevant' }],
    }
    const { cleaned, warnings } = factGuard(master, output)
    expect(cleaned.roles.map((r) => r.company)).toEqual(['Acme Corp', 'Beta LLC'])
    expect(cleaned.roles[1].bullets.map((b) => b.text)).toEqual(master.roles[1].bullets)
    expect(warnings.map((w) => w.type)).toEqual(expect.arrayContaining(['entry_discarded', 'entry_restored']))
  })

  it('restores a changed employer name on a known role', () => {
    const output = cleanOutput()
    output.roles[0].company = 'Acme Corporation International'
    const { cleaned, warnings } = factGuard(master, output)
    expect(cleaned.roles[0].company).toBe('Acme Corp')
    expect(warnings[0]).toMatchObject({ type: 'fact_restored', id: 'role_a' })
  })

  it('reverts a bullet that introduces a new metric', () => {
    const output = cleanOutput()
    output.roles[0].bullets[1] = {
      text: 'Built a React dashboard used by 40 analysts, saving $50k per year',
      reason: 'Added impact',
    }
    const { cleaned, warnings } = factGuard(master, output)
    expect(cleaned.roles[0].bullets[1].text).toBe('Built a React dashboard used by 40 internal analysts')
    const numberWarnings = warnings.filter((w) => w.type === 'new_number')
    expect(numberWarnings).toHaveLength(1)
    expect(numberWarnings[0].message).toContain('50000')
  })

  it('flags a percentage the master never claimed', () => {
    const output = cleanOutput()
    output.roles[0].bullets[2] = { text: 'Raised test coverage to 90% with Jest', reason: 'Quantified' }
    const { cleaned, warnings } = factGuard(master, output)
    expect(cleaned.roles[0].bullets[2].text).toBe('Wrote unit tests with Jest for shared components')
    expect(warnings.some((w) => w.type === 'new_number')).toBe(true)
  })

  it('reverts a summary that invents years of experience', () => {
    const output = cleanOutput()
    output.summary = 'Frontend developer with 5+ years of React experience.'
    const { cleaned, warnings } = factGuard(master, output)
    expect(cleaned.summary).toBe(master.summary)
    expect(warnings[0]).toMatchObject({ type: 'new_number', section: 'summary' })
  })

  it('drops an invented skill but keeps ones mentioned in bullet text', () => {
    const output = cleanOutput()
    output.skills = ['React', 'GraphQL', 'HTML', 'Kubernetes', 'service workers']
    const { cleaned, warnings } = factGuard(master, output)
    expect(cleaned.skills).toEqual(['React', 'HTML', 'service workers'])
    const skillWarning = warnings.find((w) => w.type === 'skill_dropped')
    expect(skillWarning?.message).toContain('GraphQL')
    expect(skillWarning?.message).toContain('Kubernetes')
  })

  it('ignores product names with digits like EC2 or Web3', () => {
    expect(extractNumberTokens('Deployed on EC2 and S3, built Web3 apps')).toEqual([])
    expect(extractNumberTokens('$1.2M budget, 3x faster, 30% less')).toEqual(['1200000', '3x', '30%'])
  })
})

describe('keyword coverage', () => {
  it('reports master vs tailored coverage and missing keywords', () => {
    const { cleaned } = factGuard(master, cleanOutput())
    const report = coverageReport(master, cleaned)
    // React, TypeScript, Jest present in both; GraphQL and accessibility missing
    expect(report.master.score).toBe(60)
    expect(report.tailored.score).toBe(60)
    expect(report.tailored.missing).toEqual(['GraphQL', 'accessibility'])
  })
})

describe('buildTailorInput / applyTailorOutput', () => {
  const stored = {
    contactInfo: { firstName: 'Jo', lastName: 'Doe', email: 'jo@example.com' },
    professionalSummary: { summary: 'Old summary', keyStrengths: ['x'], careerLevel: 'mid' },
    workExperience: [
      { role: 'Dev', company: 'Acme', dates: '2020-01 - 2021-01', achievements: ['Did a thing'] },
      { id: 'w2', jobTitle: 'Intern', company: 'Beta', startDate: '2019-01', endDate: '2019-06', description: 'One\nTwo' },
    ],
    education: [{ school: 'U of M', degree: 'BS', year: '2019' }],
    skills: { technical: ['React', 'CSS'], tools: ['Git'] },
    projects: [],
  }

  it('normalizes legacy shapes, assigns stable ids, and never sends contact info', () => {
    const input = buildTailorInput(stored)
    expect(input.roles[0]).toMatchObject({ id: 'role_0', title: 'Dev', startDate: '2020-01', endDate: '2021-01' })
    expect(input.roles[1]).toMatchObject({ id: 'w2', bullets: ['One', 'Two'] })
    expect(input.education[0]).toMatchObject({ id: 'edu_0', institution: 'U of M', graduationYear: '2019' })
    expect(JSON.stringify(input)).not.toContain('jo@example.com')
  })

  it('merges output into the master shape without touching facts or contact info', () => {
    const input = buildTailorInput(stored)
    const output: TailorOutput = {
      targetKeywords: [],
      summary: 'New summary',
      roles: [
        { ...input.roles[0], bullets: [{ text: 'Did a thing well', reason: '' }] },
        { ...input.roles[1], bullets: [{ text: 'Two', reason: '' }] },
      ],
      education: [],
      projects: [],
      skills: ['Git', 'React'],
    }
    const tailored = applyTailorOutput(stored, input, factGuard(input, output).cleaned)
    expect(tailored.contactInfo).toEqual(stored.contactInfo)
    expect(tailored.professionalSummary).toMatchObject({ summary: 'New summary', keyStrengths: ['x'] })
    expect(tailored.workExperience[0]).toMatchObject({ id: 'role_0', role: 'Dev', dates: '2020-01 - 2021-01', achievements: ['Did a thing well'] })
    expect(tailored.skills).toEqual({ technical: ['React'], tools: ['Git'] })
    expect(tailored.education[0]).toMatchObject({ school: 'U of M', id: 'edu_0' })
    // master object untouched
    expect(stored.workExperience[0].achievements).toEqual(['Did a thing'])
  })
})

describe('extractNumberTokens dates', () => {
  it('does not turn month numbers into metrics', () => {
    expect(extractNumberTokens('2021-05 to 05/2022')).toEqual(['2021', '2022'])
  })
})
