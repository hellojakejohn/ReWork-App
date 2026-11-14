import { describe, expect, it } from 'vitest'
import { buildPrepPrompt, bulletsFor, guardPrep, numberedBullets, readStoredInterviewPrep } from '@/lib/interview-prep'
import type { ParsedResume } from '@/types/parsed-resume'

const tailored: ParsedResume = {
  contact: { fullName: 'Jane Doe', headline: '', email: '', phone: '', location: '', links: [] },
  summary: 'Engineer who builds billing systems.',
  skills: [],
  experience: [
    { id: 'e1', title: 'Engineer', company: 'Acme', location: '', startDate: '2021', endDate: '', current: true, bullets: ['Built the billing service in TypeScript', 'Cut checkout errors by 30%'] },
  ],
  projects: [{ id: 'p1', name: 'Ledger', url: '', dates: '', bullets: ['Open-source double-entry ledger in Go'], tech: [] }],
  education: [],
  certifications: [],
  extraSections: [],
}
const allowedText = 'Jane Doe Engineer Acme Built the billing service in TypeScript Cut checkout errors by 30% Ledger Go Northwind Product Engineer'
const job = { title: 'Product Engineer', company: 'Northwind', description: 'Northwind needs a Product Engineer for Stripe payments in React.' }

describe('numberedBullets', () => {
  it('numbers role and project bullets from 1 with their source', () => {
    expect(numberedBullets(tailored)).toEqual([
      { n: 1, text: 'Built the billing service in TypeScript', source: 'Engineer at Acme' },
      { n: 2, text: 'Cut checkout errors by 30%', source: 'Engineer at Acme' },
      { n: 3, text: 'Open-source double-entry ledger in Go', source: 'Ledger' },
    ])
    expect(buildPrepPrompt({ tailored, allowedText, job })).toContain('2. [Engineer at Acme] Cut checkout errors by 30%')
  })
})

describe('bulletsFor', () => {
  it('maps numbers to exact bullet text and drops unknown or repeated numbers', () => {
    const b = numberedBullets(tailored)
    expect(bulletsFor([2, 2, 9, 1.5, 'x', 3], b)).toEqual(['Cut checkout errors by 30%', 'Open-source double-entry ledger in Go'])
    expect(bulletsFor(undefined, b)).toEqual([])
  })
})

describe('guardPrep', () => {
  it('keeps real proof and drops invented claims in the prose', () => {
    const out = guardPrep(
      {
        questions: [
          { question: 'How have you worked on payments?', why: 'They want payments experience for Stripe work.', bulletNumbers: [1, 2], angle: 'Lead with the billing service — then the 30% drop in errors. Mention you managed 8 engineers on Kubernetes.' },
          { question: 'Have you used React?', why: 'The role is React-heavy.', bulletNumbers: [], angle: 'Be honest and talk about how you learn new frameworks.' },
        ],
        askThem: ['What does success look like for this Product Engineer in 90 days?', 'How does Northwind split payments work across teams?', 'Do you use Kafka with Kubernetes here?'],
      },
      { tailored, allowedText, job }
    )
    expect(out.questions[0].bullets).toEqual(['Built the billing service in TypeScript', 'Cut checkout errors by 30%'])
    expect(out.questions[0].angle).toBe('Lead with the billing service, then the 30% drop in errors.')
    expect(out.questions[1].bullets).toEqual([])
    // Numbers are fine in questions about the job; names not in the resume or post are not.
    expect(out.askThem).toEqual(['What does success look like for this Product Engineer in 90 days?', 'How does Northwind split payments work across teams?'])
  })
})

describe('readStoredInterviewPrep', () => {
  it('reads saved prep and rejects junk', () => {
    expect(readStoredInterviewPrep(null)).toBeNull()
    expect(readStoredInterviewPrep({ questions: 'no' })).toBeNull()
    expect(readStoredInterviewPrep({ questions: [{ question: 'Q' }, null], askThem: ['A', 3] })).toMatchObject({ questions: [{ question: 'Q', why: '', bullets: [], angle: '' }], askThem: ['A'] })
  })
})
