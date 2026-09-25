// Evidence interview: weak-bullet selection, question hygiene, and the rule that a rewrite
// may only use the original bullet plus the user's own answers. OpenAI is always mocked.
import { describe, expect, it, vi } from 'vitest'
import {
  applyRewrites,
  bulletWeakness,
  candidateForBullet,
  evidenceFacts,
  generateQuestions,
  guardRewrite,
  isNonAnswer,
  mergeEvidence,
  rewriteWithEvidence,
  weakBulletCandidates,
  type EvidenceAnswer,
  type EvidenceItem,
} from '@/lib/evidence'
import type { ParsedResume } from '@/types/parsed-resume'

const resume: ParsedResume = {
  contact: { fullName: 'Jakob Johnson', headline: '', email: '', phone: '', location: '', links: [] },
  summary: '',
  skills: [],
  experience: [
    {
      id: 'exp_1',
      title: 'Store Manager',
      company: 'Target',
      location: '',
      startDate: '2019',
      endDate: '2022',
      current: false,
      bullets: [
        'Helped with inventory',
        'Reduced shrink 22% in 6 months by retraining 14 cashiers on loss prevention',
        'Worked on scheduling for the team',
      ],
    },
  ],
  projects: [{ id: 'proj_1', name: 'Vesting Vault', url: '', dates: '', bullets: ['Wrote a vesting contract'], tech: [] }],
  education: [],
  certifications: [],
  extraSections: [],
}

function client(content: unknown) {
  const create = vi.fn(async () => ({ model: 'gpt-test', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }))
  return { client: { chat: { completions: { create } } } as never, create }
}

const item: EvidenceItem = {
  id: 'exp_1:0',
  section: 'roles',
  entryId: 'exp_1',
  entryLabel: 'Store Manager at Target',
  index: 0,
  bullet: 'Helped with inventory',
  weakness: 'No scale',
  questions: [
    { id: 'exp_1:0:q0', text: 'Roughly how many SKUs?' },
    { id: 'exp_1:0:q1', text: 'What changed after, and by how much?' },
  ],
}

const answer = (questionId: string, text: string): EvidenceAnswer => ({
  itemId: item.id,
  entryLabel: item.entryLabel,
  bullet: item.bullet,
  questionId,
  question: item.questions.find((q) => q.id === questionId)?.text ?? '',
  answer: text,
  answeredAt: '2026-09-25T00:00:00Z',
})

describe('weak bullets', () => {
  it('scores vague, number-free, outcome-free bullets as weak and leaves strong ones alone', () => {
    expect(bulletWeakness('Helped with inventory').reasons).toEqual(['No scale or numbers', 'Vague verb', 'No outcome', 'Short'])
    const ids = weakBulletCandidates(resume).map((c) => c.id)
    expect(ids).toContain('exp_1:0')
    expect(ids).toContain('proj_1:0')
    expect(ids).not.toContain('exp_1:1') // has numbers and an outcome
  })

  it('finds a specific bullet for the Changes tab entry point', () => {
    expect(candidateForBullet(resume, 'exp_1', '  worked on scheduling for the team ')).toMatchObject({ id: 'exp_1:2', index: 2 })
    expect(candidateForBullet(resume, 'exp_1', 'Not a real bullet')).toBeNull()
  })
})

describe('generateQuestions', () => {
  it('keeps only known ids, caps questions at 3 and cleans them up', async () => {
    const { client: c } = client({
      items: [
        { id: 'exp_1:0', weakness: 'No scale', questions: ['1. Roughly how many SKUs', 'What changed after?', 'Who asked for it?', 'A fourth?'] },
        { id: 'made_up:9', weakness: 'x', questions: ['?'] },
        { id: 'proj_1:0', weakness: 'No outcome', questions: [] },
      ],
    })
    const items = await generateQuestions(weakBulletCandidates(resume), { client: c })
    expect(items).toHaveLength(1)
    expect(items[0].questions.map((q) => q.text)).toEqual(['Roughly how many SKUs?', 'What changed after?', 'Who asked for it?'])
    expect(items[0].bullet).toBe('Helped with inventory')
  })
})

describe('rewriteWithEvidence', () => {
  it('uses the user’s numbers and passes them through the guard', async () => {
    const { client: c, create } = client({ rewrites: [{ id: 'exp_1:0', text: 'Managed inventory for about 4,000 SKUs, cutting stockouts 30%' }] })
    const [rewrite] = await rewriteWithEvidence([item], [answer('exp_1:0:q0', 'about 4,000'), answer('exp_1:0:q1', 'stockouts dropped 30%')], { client: c })
    expect(rewrite).toMatchObject({ before: 'Helped with inventory', after: 'Managed inventory for about 4,000 SKUs, cutting stockouts 30%' })
    expect(rewrite.warning).toBeUndefined()
    const prompt = (create.mock.calls[0] as unknown as [{ messages: { content: string }[] }])[0].messages[1].content
    expect(prompt).toContain('A: about 4,000')
  })

  it('rejects a rewrite that adds a number or tool the user never gave, and keeps the original', async () => {
    const { client: c } = client({ rewrites: [{ id: 'exp_1:0', text: 'Managed 4,000 SKUs in SAP, saving $50K a year' }] })
    const [rewrite] = await rewriteWithEvidence([item], [answer('exp_1:0:q0', '4000')], { client: c })
    expect(rewrite.after).toBe('Helped with inventory')
    expect(rewrite.warning).toMatch(/SAP/)
    expect(rewrite.warning).toMatch(/50K/)
  })

  it('does not accept numbers from the rest of the resume, only this bullet’s answers', () => {
    // 22% is on another bullet in the master; it isn't evidence for this one.
    expect(guardRewrite(item, [answer('exp_1:0:q0', '4000')], 'Managed 4,000 SKUs and cut shrink 22%').ok).toBe(false)
    expect(guardRewrite(item, [answer('exp_1:0:q0', '4000')], 'Managed inventory across 4,000 SKUs').ok).toBe(true)
  })

  it('skips bullets where every answer was "don’t know" and makes no call at all', async () => {
    const { client: c, create } = client({ rewrites: [] })
    const out = await rewriteWithEvidence([item], [answer('exp_1:0:q0', "Don't know"), answer('exp_1:0:q1', '  ')], { client: c })
    expect(out).toEqual([])
    expect(create).not.toHaveBeenCalled()
  })
})

describe('applying accepted rewrites to the master', () => {
  it('replaces only accepted bullets that still match, by position or text', () => {
    const { resume: next, applied } = applyRewrites(resume, [
      { section: 'roles', entryId: 'exp_1', index: 0, before: 'Helped with inventory', after: 'Managed inventory for 4,000 SKUs' },
      { section: 'roles', entryId: 'exp_1', index: 0, before: 'Worked on scheduling for the team', after: 'Built weekly schedules for 14 people' }, // moved: found by text
      { section: 'roles', entryId: 'exp_1', index: 1, before: 'Something edited since', after: 'Stale' },
    ])
    expect(applied).toBe(2)
    expect(next.experience[0].bullets).toEqual([
      'Managed inventory for 4,000 SKUs',
      'Reduced shrink 22% in 6 months by retraining 14 cashiers on loss prevention',
      'Built weekly schedules for 14 people',
    ])
    expect(resume.experience[0].bullets[0]).toBe('Helped with inventory') // input untouched
  })
})

describe('stored answers', () => {
  it('treats "don’t know" style answers as no answer', () => {
    for (const a of ["don't know", 'Dont know', 'I don’t know', 'n/a', 'idk', '', '?']) {
      expect(isNonAnswer(a.replace('’', "'"))).toBe(true)
    }
    expect(isNonAnswer('about 40')).toBe(false)
  })

  it('merges by bullet + question and exposes real answers as facts', () => {
    const first = mergeEvidence(null, [answer('exp_1:0:q0', '3000'), answer('exp_1:0:q1', "don't know")])
    const second = mergeEvidence(first, [answer('exp_1:0:q0', 'about 4,000')])
    expect(second.answers).toHaveLength(2)
    expect(evidenceFacts(second)).toEqual(['about 4,000 (about: Helped with inventory)'])
  })
})

describe('re-tailoring with stored answers', () => {
  it('lets the tailor fact guard keep a number the user confirmed, and still reverts invented ones', async () => {
    const { buildTailorInput } = await import('@/lib/tailor')
    const { factGuard } = await import('@/lib/fact-guard')
    const { parsedToMaster } = await import('@/lib/master-resume')
    const input = buildTailorInput(parsedToMaster(resume))
    const output = {
      targetKeywords: [],
      summary: '',
      roles: input.roles.map((r) => ({ ...r, bullets: [{ text: 'Managed inventory across 4,000 SKUs', reason: '' }, { text: 'Cut costs 90%', reason: '' }] })),
      education: [],
      projects: input.projects.map((p) => ({ ...p, bullets: p.bullets.map((text) => ({ text, reason: '' })) })),
      skills: [],
    }
    const without = factGuard(input, output).cleaned.roles[0].bullets.map((b) => b.text)
    expect(without).not.toContain('Managed inventory across 4,000 SKUs')

    input.evidence = evidenceFacts(mergeEvidence(null, [answer('exp_1:0:q0', 'about 4,000')]))
    const withEvidence = factGuard(input, output).cleaned.roles[0].bullets.map((b) => b.text)
    expect(withEvidence).toContain('Managed inventory across 4,000 SKUs')
    expect(withEvidence).not.toContain('Cut costs 90%')
  })
})
