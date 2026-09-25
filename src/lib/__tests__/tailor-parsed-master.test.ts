// The tailor pipeline on a master saved by the new parser (skill groups, projects,
// certifications), plus the Changes tab's accept/revert.
import { describe, expect, it } from 'vitest'
import { applyTailorOutput, buildTailorInput } from '@/lib/tailor'
import { factGuard } from '@/lib/fact-guard'
import { coverageReport } from '@/lib/keyword-coverage'
import { applyChangeDecision, buildChanges } from '@/lib/tailor-changes'
import { masterToParsed, parsedToMaster } from '@/lib/master-resume'
import type { ParsedResume } from '@/types/parsed-resume'
import type { TailorOutput } from '@/types/tailor'

const parsed: ParsedResume = {
  contact: { fullName: 'Jakob Johnson', headline: 'Software Engineer', email: 'j@x.io', phone: '', location: 'Saint Paul, MN', links: [] },
  summary: 'Full-stack engineer shipping web apps.',
  skills: [
    { group: 'Languages', items: ['TypeScript', 'Solidity'] },
    { group: 'Tools', items: ['Docker', 'Prisma'] },
  ],
  experience: [
    {
      id: 'exp_1',
      title: 'Founder',
      company: 'ReWork',
      location: '',
      startDate: '2024',
      endDate: '',
      current: true,
      bullets: ['Built an AI resume app with Next.js', 'Integrated Stripe billing'],
    },
  ],
  projects: [
    { id: 'proj_1', name: 'Vesting Vault', url: '', dates: '', bullets: ['Wrote a vesting contract with 100% coverage'], tech: ['Foundry'] },
  ],
  education: [{ id: 'edu_1', school: 'Metana', credential: 'Solidity Bootcamp', field: '', startDate: '', endDate: '2025', details: [] }],
  certifications: [{ name: 'AWS Certified Cloud Practitioner', issuer: 'Amazon', date: '2023' }],
  extraSections: [],
}
const master = parsedToMaster(parsed)

function output(): TailorOutput {
  const input = buildTailorInput(master)
  return {
    targetKeywords: ['TypeScript', 'Docker', 'AWS Certified Cloud Practitioner', 'Kubernetes', 'Foundry'],
    summary: 'TypeScript engineer who ships full-stack web apps.',
    roles: [
      {
        ...input.roles[0],
        bullets: [
          { text: 'Integrated Stripe billing end to end', reason: 'Matches payments work' },
          { text: 'Built an AI resume app with Next.js', reason: 'Kept' },
        ],
      },
    ],
    education: [{ id: 'edu_1', degree: 'Solidity Bootcamp', institution: 'Metana', graduationYear: '2025' }],
    projects: [{ id: 'proj_1', name: 'Vesting Vault', description: 'A token vesting vault for teams', bullets: [{ text: 'Wrote a Foundry-tested vesting contract with 100% coverage', reason: 'Tooling' }] }],
    skills: ['Docker', 'AWS Certified Cloud Practitioner', 'TypeScript', 'Kubernetes'],
  }
}

describe('buildTailorInput on a parsed master', () => {
  it('includes skill groups, flattened skills, projects and certifications', () => {
    const input = buildTailorInput(master)
    expect(input.skills).toEqual(['TypeScript', 'Solidity', 'Docker', 'Prisma'])
    expect(input.skillGroups.map((g) => g.group)).toEqual(['Languages', 'Tools'])
    expect(input.certifications).toEqual(['AWS Certified Cloud Practitioner, Amazon'])
    expect(input.projects[0]).toMatchObject({ id: 'proj_1', technologies: ['Foundry'], bullets: ['Wrote a vesting contract with 100% coverage'] })
    expect(input.roles[0]).toMatchObject({ title: 'Founder', endDate: 'Present' })
  })
})

describe('factGuard with certifications and project tech', () => {
  it('keeps a skill that is a certification or project tech, drops invented ones', () => {
    const input = buildTailorInput(master)
    const { cleaned, warnings } = factGuard(input, output())
    expect(cleaned.skills).toEqual(['Docker', 'AWS Certified Cloud Practitioner', 'TypeScript'])
    expect(warnings.find((w) => w.type === 'skill_dropped')?.attempted).toBe('Kubernetes')
  })

  it('counts certifications and project tech in keyword coverage', () => {
    const input = buildTailorInput(master)
    const { cleaned } = factGuard(input, output())
    const coverage = coverageReport(input, cleaned)
    expect(coverage.master.present).toEqual(['TypeScript', 'Docker', 'AWS Certified Cloud Practitioner', 'Foundry'])
    expect(coverage.tailored.missing).toEqual(['Kubernetes'])
  })
})

describe('applyTailorOutput with skill groups', () => {
  it('keeps the master groups, reorders inside them, and passes certifications through', () => {
    const input = buildTailorInput(master)
    const { cleaned } = factGuard(input, output())
    const tailored = applyTailorOutput(master, input, cleaned)
    expect(tailored.skills).toEqual([
      { group: 'Languages', items: ['TypeScript'] },
      { group: 'Tools', items: ['Docker'] },
      { group: '', items: ['AWS Certified Cloud Practitioner'] },
    ])
    const view = masterToParsed(tailored)
    expect(view.certifications).toEqual(parsed.certifications)
    expect(view.contact).toEqual(parsed.contact)
    expect(view.experience[0].bullets).toEqual(['Integrated Stripe billing end to end', 'Built an AI resume app with Next.js'])
    // The master project had no description, so the model's one is not added as a bullet.
    expect(view.projects[0].bullets).toEqual(['Wrote a Foundry-tested vesting contract with 100% coverage'])
  })
})

describe('buildChanges / applyChangeDecision', () => {
  it('lists only changed bullets with their closest original, and reverts/accepts them', () => {
    const input = buildTailorInput(master)
    const { cleaned } = factGuard(input, output())
    const changes = buildChanges(input, cleaned)
    expect(changes.map((c) => c.id)).toEqual(['summary', 'exp_1:0', 'proj_1:0'])
    const stripe = changes.find((c) => c.id === 'exp_1:0')!
    expect(stripe).toMatchObject({
      before: 'Integrated Stripe billing',
      after: 'Integrated Stripe billing end to end',
      reason: 'Matches payments work',
      entryLabel: 'Founder at ReWork',
    })

    const tailored = applyTailorOutput(master, input, cleaned)
    const reverted = applyChangeDecision(tailored, stripe, 'reverted')
    expect(masterToParsed(reverted).experience[0].bullets[0]).toBe('Integrated Stripe billing')
    expect(masterToParsed(tailored).experience[0].bullets[0]).toBe('Integrated Stripe billing end to end') // not mutated
    const accepted = applyChangeDecision(reverted, stripe, 'accepted')
    expect(masterToParsed(accepted).experience[0].bullets[0]).toBe('Integrated Stripe billing end to end')

    const summary = changes.find((c) => c.id === 'summary')!
    expect(masterToParsed(applyChangeDecision(tailored, summary, 'reverted')).summary).toBe(parsed.summary)
  })
})

describe('callTailorModel errors', () => {
  it('says tailoring is unavailable (not "busy") when OpenAI is out of quota', async () => {
    const { callTailorModel, TailorError } = await import('@/lib/tailor')
    const spy = (await import('vitest')).vi.spyOn(console, 'error').mockImplementation(() => {})
    const client = {
      chat: {
        completions: {
          create: async () => {
            throw Object.assign(new Error('429 You exceeded your current quota'), { status: 429, code: 'insufficient_quota' })
          },
        },
      },
    }
    const error = await callTailorModel(buildTailorInput(master), { title: 'x', company: 'y', description: 'z' }, { client: client as never }).catch((e) => e)
    spy.mockRestore()
    expect(error).toBeInstanceOf(TailorError)
    expect(error.userMessage).toBe("Tailoring is temporarily unavailable, we're on it.")
    expect(error.status).toBe(503)
  })
})
