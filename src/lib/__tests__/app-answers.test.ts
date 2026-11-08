import { describe, expect, it } from 'vitest'
import { buildAnswerPrompt, checkAnswer, guardAnswer, readStoredAnswers } from '@/lib/app-answers'
import type { TailorInput } from '@/types/tailor'

const allowed = 'Jane Doe\nSoftware Engineer at Acme. Built the billing service in TypeScript and Postgres. Cut checkout errors by 30%.\nProduct Engineer\nNorthwind'
const job = 'Northwind is hiring a Product Engineer to work on Stripe payments with React.'

describe('checkAnswer', () => {
  it('passes an answer built from the resume', () => {
    const a = 'I want to work at Northwind because I like building payments. At Acme I built the billing service in TypeScript and Postgres and cut checkout errors by 30%. I would bring that same care to the Product Engineer role, where payments are central to the work and to customers.'
    expect(checkAnswer(a, allowed, job, 'short').bad).toBe(false)
  })

  it('flags invented numbers and tools, and stock phrases', () => {
    const r = checkAnswer('I am passionate about payments. I led a team of 12 engineers using Kubernetes at Acme.', allowed, job, 'short')
    expect(r.bad).toBe(true)
    expect(r.problems.banned).toContain('passionate about')
    expect(r.problems.facts).toMatch(/12/)
    expect(r.problems.facts).toMatch(/Kubernetes/)
  })
})

describe('guardAnswer', () => {
  it('drops only the sentences with unsupported claims and removes em-dashes', () => {
    const { answer, warnings } = guardAnswer(
      'At Acme I built the billing service in TypeScript — and I enjoyed it. I also scaled it to 5 million users with Kubernetes. Northwind uses Stripe, which I would like to learn.',
      allowed,
      job,
      'short'
    )
    expect(answer).toBe('At Acme I built the billing service in TypeScript, and I enjoyed it. Northwind uses Stripe, which I would like to learn.')
    expect(warnings.some((w) => w.type === 'unsupported_fact')).toBe(true)
    expect(answer).not.toMatch(/—/)
  })
})

describe('readStoredAnswers', () => {
  it('keeps good rows and fills defaults', () => {
    const rows = readStoredAnswers([{ id: 'a', question: 'q', answer: 'x' }, { nope: true }, null])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ length: 'medium', needsYou: null, warnings: [], edited: false })
    expect(readStoredAnswers(undefined)).toEqual([])
  })
})

describe('buildAnswerPrompt', () => {
  it('carries the question, length and the no-fabrication rule', () => {
    const p = buildAnswerPrompt({
      master: { summary: '', roles: [], projects: [], skills: [] } as unknown as TailorInput,
      tailoredText: '',
      candidateName: 'Jane',
      job: { title: 'Engineer', company: 'Northwind', description: job },
      question: 'What salary do you expect?',
      length: 'long',
    })
    expect(p).toContain('What salary do you expect?')
    expect(p).toContain('200-280 words')
    expect(p).toContain('Never fabricate')
    expect(p).not.toMatch(/—/)
  })
})
