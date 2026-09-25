// Cover letter: banned phrases trigger one regenerate, the fact guard removes what the
// resume doesn't support, and nothing ever calls the real OpenAI API.
import { describe, expect, it, vi } from 'vitest'
import { buildTailorInput } from '@/lib/tailor'
import { parsedToMaster } from '@/lib/master-resume'
import {
  bannedPhrasesIn,
  buildCoverLetterPrompt,
  checkDraft,
  allowedSourceText,
  generateCoverLetter,
  guardDraft,
  type CoverLetterDraft,
  type CoverLetterInput,
} from '@/lib/cover-letter'
import type { ParsedResume } from '@/types/parsed-resume'

const parsed: ParsedResume = {
  contact: { fullName: 'Jakob Johnson', headline: 'Software Engineer', email: 'j@x.io', phone: '', location: 'Saint Paul, MN', links: [] },
  summary: 'Full-stack engineer shipping web apps.',
  skills: [{ group: 'Languages', items: ['TypeScript', 'Solidity'] }],
  experience: [
    {
      id: 'exp_1',
      title: 'Founder',
      company: 'ReWork',
      location: '',
      startDate: '2024',
      endDate: '',
      current: true,
      bullets: ['Built an AI resume app with Next.js used by 300 job seekers', 'Integrated Stripe billing'],
    },
  ],
  projects: [{ id: 'proj_1', name: 'Vesting Vault', url: '', dates: '', bullets: ['Wrote a vesting contract with 100% test coverage'], tech: ['Foundry'] }],
  education: [{ id: 'edu_1', school: 'Metana', credential: 'Solidity Bootcamp', field: '', startDate: '', endDate: '2025', details: [] }],
  certifications: [],
  extraSections: [],
}

const input: CoverLetterInput = {
  master: buildTailorInput(parsedToMaster(parsed)),
  tailoredText: 'Founder at ReWork. Built an AI resume app with Next.js used by 300 job seekers.',
  candidateName: 'Jakob Johnson',
  job: { title: 'Full-Stack Engineer', company: 'Acme', description: 'We use React, Kubernetes and Go. Hiring manager: Dana Lee.' },
  tone: 'direct',
}

// ~90 words of resume-backed prose, reused to reach a realistic length.
const filler =
  'At ReWork I built an AI resume app with Next.js that 300 job seekers have used, and I handled the product end to end, from the data model to the billing flow. ' +
  'I integrated Stripe billing so people could pay for what they used, and I learned to keep the details boring and reliable. ' +
  'That is the kind of work I want to keep doing on a small team that ships often.'

function draft(overrides: Partial<CoverLetterDraft> = {}): CoverLetterDraft {
  return {
    greeting: 'Dear Acme team,',
    whyThisRole: `Acme is hiring a Full-Stack Engineer to own features across the stack. ${filler}`,
    proof: `On Vesting Vault I wrote a vesting contract in Solidity with 100% test coverage using Foundry. ${filler}`,
    close: `I would like to talk about how I can help Acme ship. ${filler}`,
    signOff: 'Best,',
    ...overrides,
  }
}

function mockClient(drafts: CoverLetterDraft[]) {
  const create = vi.fn(async () => {
    const next = drafts.shift()
    if (!next) throw new Error('unexpected extra call')
    return { model: 'gpt-test', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(next), refusal: null } }] }
  })
  return { client: { chat: { completions: { create } } } as never, create }
}

describe('banned phrases', () => {
  it('catches stock openers case-insensitively and reports the longest match', () => {
    expect(bannedPhrasesIn('I am writing to express my interest in the role.')).toEqual(['i am writing to express my interest'])
    expect(bannedPhrasesIn('I’m a TEAM PLAYER.')).toEqual(['team player'])
    expect(bannedPhrasesIn('I shipped billing at ReWork.')).toEqual([])
  })

  it('regenerates once when one slips through, and the retry is told why', async () => {
    const { client, create } = mockClient([
      draft({ whyThisRole: `I am writing to express my interest in the Full-Stack Engineer role at Acme. ${filler}` }),
      draft(),
    ])
    const letter = await generateCoverLetter(input, { client })
    expect(create).toHaveBeenCalledTimes(2)
    const retryPrompt = (create.mock.calls[1] as unknown as [{ messages: { content: string }[] }])[0].messages[1].content
    expect(retryPrompt).toContain('"i am writing to express my interest"')
    expect(letter.text).not.toMatch(/i am writing to/i)
    expect(letter.warnings.map((w) => w.type)).toEqual(['regenerated'])
  })

  it('drops the sentence if the retry still uses one, and never calls a third time', async () => {
    const bad = draft({ close: `I am a proven track record kind of engineer. ${filler}` })
    const { client, create } = mockClient([bad, bad])
    const letter = await generateCoverLetter(input, { client })
    expect(create).toHaveBeenCalledTimes(2)
    expect(letter.text).not.toMatch(/proven track record/i)
    expect(letter.warnings.some((w) => w.type === 'banned_phrase')).toBe(true)
  })
})

describe('cover letter fact guard', () => {
  it('flags numbers, employers, tools and credentials that are not in the resume', () => {
    const problems = checkDraft(
      draft({ proof: 'At Google I led five engineers on a Kubernetes migration that cut costs 40%. I hold a PMP.' }),
      allowedSourceText(input)
    )
    expect(problems.facts).toHaveLength(1)
    expect(problems.facts[0].paragraph).toBe('proof')
    for (const term of ['Google', 'five', 'Kubernetes', '40%', 'PMP']) expect(problems.facts[0].detail).toContain(term)
  })

  it('accepts resume facts: its numbers, employers, tools, the target company and title', () => {
    expect(checkDraft(draft(), allowedSourceText(input)).facts).toEqual([])
  })

  it('removes unsupported sentences after the retry and counts them as warnings', async () => {
    const invented = draft({ proof: `I also led five engineers on a Kubernetes migration at Google. ${filler}` })
    const { client } = mockClient([invented, invented])
    const letter = await generateCoverLetter(input, { client })
    expect(letter.text).not.toMatch(/Kubernetes|Google|five engineers/)
    expect(letter.text).toContain('300 job seekers')
    const removed = letter.warnings.filter((w) => w.type === 'unsupported_fact')
    expect(removed).toHaveLength(1)
    expect(removed[0].attempted).toContain('Kubernetes')
  })

  it('lets confirmed evidence answers through like resume facts', () => {
    const withEvidence = { ...input, extraFacts: ['Cut checkout errors by 35% after the Stripe rewrite'] }
    const text = 'After the Stripe rewrite, checkout errors dropped 35%.'
    expect(checkDraft(draft({ proof: text }), allowedSourceText(withEvidence)).facts).toEqual([])
    expect(checkDraft(draft({ proof: text }), allowedSourceText(input)).facts).toHaveLength(1)
  })

  it('resets an invented greeting name but keeps one the job post gives', () => {
    expect(guardDraft(draft({ greeting: 'Dear Sarah,' }), input).draft.greeting).toBe('Dear Hiring Team,')
    expect(guardDraft(draft({ greeting: 'Dear Dana Lee,' }), input).draft.greeting).toBe('Dear Dana Lee,')
    expect(guardDraft(draft({ greeting: 'To whom it may concern,' }), input).draft.greeting).toBe('Dear Hiring Team,')
  })

  it('signs with the real name and a clean sign-off', async () => {
    const { client } = mockClient([draft({ signOff: 'Best, Jakob' })])
    const letter = await generateCoverLetter(input, { client })
    expect(letter.text.endsWith('Sincerely,\nJakob Johnson')).toBe(true)
    expect(letter.text.startsWith('Dear Acme team,\n\n')).toBe(true)
    expect(letter.text.split('\n\n')).toHaveLength(5) // greeting, 3 paragraphs, sign-off
  })
})

describe('prompt', () => {
  it('carries tone, the length target, the banned list and the no-fabrication rule', () => {
    const prompt = buildCoverLetterPrompt(input)
    expect(prompt).toContain('Direct:')
    expect(prompt).toContain('250-350 words')
    expect(prompt).toContain('"to whom it may concern"')
    expect(prompt).toMatch(/Never fabricate/)
  })
})
