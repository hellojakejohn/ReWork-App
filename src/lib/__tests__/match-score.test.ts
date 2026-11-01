// The match score never goes down for wording, and the job's spelling of a skill the
// resume shows isn't treated as a new claim. Fixture shaped like the Nov 1 Trane run.
import { describe, expect, it } from 'vitest'
import { factGuard } from '@/lib/fact-guard'
import { coverageReport } from '@/lib/keyword-coverage'
import { buildTailorPrompt } from '@/lib/tailor'
import type { TailorInput, TailorOutput } from '@/types/tailor'

const master: TailorInput = {
  summary: 'Full-stack engineer shipping web and mobile products in TypeScript: React and Next.js frontends, Node.js and PostgreSQL backends.',
  roles: [
    {
      id: 'role_tq',
      title: 'Founding Engineer',
      company: 'TripQuest Inc.',
      startDate: '03/2026',
      endDate: 'Present',
      location: 'Saint Paul, MN',
      bullets: [
        'Own the full-stack architecture as first and only engineer on a funded travel platform',
        'Set up the spec and code review pipeline before the first client meeting',
        'Shipped the iOS app in React Native and Expo with Solana Pay',
      ],
    },
  ],
  education: [],
  projects: [
    {
      id: 'proj_welp',
      name: 'Welp',
      description: 'Onchain reputation app',
      technologies: ['Solidity', 'Foundry'],
      bullets: ['Designed and tested the full token system with Foundry coverage; deployed and verified all contracts'],
    },
  ],
  skills: ['TypeScript', 'React', 'React Native', 'Next.js', 'Node.js', 'PostgreSQL', 'Solidity'],
  skillGroups: [
    { group: 'Languages', items: ['TypeScript', 'Solidity'] },
    { group: 'Frameworks', items: ['React', 'React Native', 'Next.js', 'Node.js'] },
    { group: 'Data', items: ['PostgreSQL'] },
  ],
  certifications: [],
}

const keywords = ['Full Stack', 'Front-End', 'Back-End', 'TypeScript', 'React', 'SQL', 'Code Review', 'Testing', 'Kubernetes']

function output(over: Partial<TailorOutput> = {}): TailorOutput {
  return {
    targetKeywords: keywords,
    summary: 'Full-stack engineer who builds front-end and back-end systems in TypeScript, React and SQL.',
    roles: [
      {
        id: 'role_tq',
        title: 'Founding Engineer',
        company: 'TripQuest Inc.',
        startDate: '03/2026',
        endDate: 'Present',
        bullets: [
          { text: 'Own Front-End and Back-End architecture as first and only engineer on a funded travel platform', reason: 'Job wording' },
          { text: 'Set up the spec and code review pipeline before the first client meeting', reason: 'Kept' },
          { text: 'Shipped the iOS app in React Native and Expo with Solana Pay', reason: 'Kept' },
        ],
      },
    ],
    education: [],
    projects: [
      {
        id: 'proj_welp',
        name: 'Welp',
        description: 'Onchain reputation app',
        bullets: [{ text: 'Designed and tested the full token system with Foundry coverage; deployed and verified all contracts', reason: 'Kept' }],
      },
    ],
    skills: ['TypeScript', 'React', 'React Native', 'Next.js', 'Node.js', 'PostgreSQL', 'SQL'],
    ...over,
  }
}

describe('match score', () => {
  it('scores the Trane misses as present', () => {
    const { master: before } = coverageReport(master, output())
    expect(before.missing).toEqual(['Kubernetes'])
  })

  it("accepts the job's spelling of a skill the resume shows", () => {
    const { cleaned, warnings } = factGuard(master, output())
    expect(warnings).toEqual([])
    expect(cleaned.roles[0].bullets[0].text).toContain('Front-End and Back-End')
    expect(cleaned.summary).toContain('SQL')
    expect(cleaned.skills).toContain('SQL')
  })

  it('still reverts a tool the resume does not show, in bullets, the summary and skills', () => {
    const out = output({
      summary: 'Full-stack engineer who runs Kubernetes clusters in TypeScript.',
      skills: ['TypeScript', 'Kubernetes'],
    })
    out.roles[0].bullets[0] = { text: 'Own the platform architecture on Kubernetes as first and only engineer', reason: 'x' }
    const { cleaned, warnings } = factGuard(master, out)
    expect(cleaned.summary).toBe(master.summary)
    expect(cleaned.roles[0].bullets[0].text).toBe(master.roles[0].bullets[0])
    expect(cleaned.skills).not.toContain('Kubernetes')
    expect(warnings.map((w) => `${w.type}:${w.section}`)).toEqual(['new_claim:summary', 'new_claim:roles', 'skill_dropped:skills'])
  })

  it('puts back a skill or bullet the rewrite lost, so the score never drops', () => {
    // The model dropped PostgreSQL (the only SQL), the code review bullet and the summary's front/back-end.
    const out = output({ summary: 'Engineer who ships products in TypeScript.', skills: ['TypeScript', 'React'] })
    out.roles[0].bullets = [out.roles[0].bullets[2]]
    out.projects[0].bullets = []
    const { cleaned } = factGuard(master, out)
    const { master: before, tailored: after } = coverageReport(master, cleaned)
    expect(cleaned.skills).toContain('PostgreSQL')
    expect(cleaned.roles[0].bullets.map((b) => b.text)).toContain(master.roles[0].bullets[1])
    expect(after.present).toEqual(expect.arrayContaining(before.present))
    expect(after.score).toBeGreaterThanOrEqual(before.score)
  })

  it('tells the model which keywords the resume shows', () => {
    const prompt = buildTailorPrompt(master, { title: 'Sr. Applications Developer', company: 'Trane', description: 'x' }, { targetKeywords: keywords })
    expect(prompt).toContain('The resume shows these, in these or other words: Full Stack, Front-End, Back-End, TypeScript, React, SQL, Code Review, Testing.')
    expect(prompt).toContain("The resume doesn't show these: Kubernetes. Never claim them.")
  })
})

describe('match score never drops', () => {
  it('holds when the model rewrites a bullet in place and loses its keyword', () => {
    const out = output()
    out.roles[0].bullets[1] = { text: 'Set up the spec pipeline before the first client meeting', reason: 'Shorter' }
    const { cleaned } = factGuard(master, out)
    expect(cleaned.roles[0].bullets[1].text).toBe(master.roles[0].bullets[1])
    expect(cleaned.roles[0].bullets).toHaveLength(3)
  })

  it('holds for every combination of dropped skills, bullets and summary', () => {
    for (let mask = 0; mask < 32; mask++) {
      const out = output()
      if (mask & 1) out.skills = ['TypeScript']
      if (mask & 2) out.summary = 'Engineer who ships products.'
      if (mask & 4) out.roles[0].bullets = out.roles[0].bullets.map((b) => ({ ...b, text: 'Shipped product work for a travel platform' }))
      if (mask & 8) out.projects[0].bullets = [{ text: 'Built the token system', reason: 'x' }]
      if (mask & 16) out.roles[0].bullets = []
      const { cleaned } = factGuard(master, out)
      const { master: before, tailored: after } = coverageReport(master, cleaned)
      expect(after.present, `mask ${mask}`).toEqual(expect.arrayContaining(before.present))
    }
  })
})

describe('Accept/Revert re-scores', () => {
  it('drops a keyword when the change that added it is reverted, and restores it on accept', async () => {
    const { buildChanges, outputWithDecisions } = await import('@/lib/tailor-changes')
    const plain = { ...master, summary: 'Engineer shipping products in TypeScript.', skills: ['TypeScript'], skillGroups: [{ group: '', items: ['TypeScript'] }] }
    const out = output({ summary: 'Engineer shipping products in TypeScript.', skills: ['TypeScript'] })
    out.roles[0].bullets[0] = { text: 'Own the full-stack architecture and code review as first and only engineer on a funded travel platform', reason: 'x' }
    const { cleaned } = factGuard(plain, out)
    const changes = buildChanges(plain, cleaned)
    const accepted = coverageReport(plain, outputWithDecisions(cleaned, changes)).tailored
    const reverted = coverageReport(plain, outputWithDecisions(cleaned, changes.map((c) => ({ ...c, status: 'reverted' as const })))).tailored
    expect(changes.length).toBeGreaterThan(0)
    expect(reverted.score).toBe(coverageReport(plain, cleaned).master.score)
    expect(accepted.score).toBeGreaterThanOrEqual(reverted.score)
  })
})
