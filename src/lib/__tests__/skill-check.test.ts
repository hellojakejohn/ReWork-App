import { describe, expect, it } from 'vitest'
import {
  applySkillAdditions,
  cleanAnswers,
  cleanKeywords,
  fallbackAdditions,
  fitCoverage,
  guardAddition,
  placeSkills,
  type SkillAnswer,
} from '@/lib/skill-check'
import type { ParsedResume } from '@/types/parsed-resume'

const resume: ParsedResume = {
  contact: { fullName: 'Jakob Johnson', headline: 'Software Engineer', email: '', phone: '', location: '', links: [] },
  summary: 'Full-stack engineer who designs and ships web products.',
  skills: [
    { group: 'Frontend', items: ['React', 'TypeScript'] },
    { group: 'Design', items: ['UX flows'] },
  ],
  experience: [
    { id: 'role-1', title: 'Founding Engineer', company: 'TripQuest Inc.', location: '', startDate: '2026-03', endDate: '', current: true, bullets: ['Designing and shipping an iOS app in React Native.'] },
  ],
  projects: [{ id: 'proj-1', name: 'ReWork', url: '', dates: '2024', bullets: ['Designed the full product from concept.'], tech: [] }],
  education: [],
  certifications: [],
  extraSections: [],
}

const figma: SkillAnswer = { keyword: 'Figma', level: 'some', note: 'took a 3-hour figma class at school' }

describe('keywords and fit', () => {
  it('cleans the model list', () => {
    expect(cleanKeywords(['Figma', 'figma', '- Sketch.', '', 'a very long phrase that is not a keyword at all'])).toEqual(['Figma', 'Sketch'])
  })
  it('scores the resume like the tailor does', () => {
    const fit = fitCoverage(['React', 'Figma', 'TypeScript', 'user research'], resume)
    expect(fit.present).toEqual(['React', 'TypeScript'])
    expect(fit.missing).toEqual(['Figma', 'user research'])
    expect(fit.score).toBe(50)
  })
})

describe('cleanAnswers', () => {
  it('keeps yes and a little for known keywords only', () => {
    const out = cleanAnswers(
      [figma, { keyword: 'Sketch', level: 'no', note: '' }, { keyword: 'Kubernetes', level: 'yes', note: '' }, { keyword: 'figma', level: 'yes', note: 'dup' }],
      ['Figma', 'Sketch']
    )
    expect(out).toEqual([figma])
  })
})

describe('guardAddition', () => {
  it('keeps a training line built from the note', () => {
    const a = guardAddition(resume, figma, { kind: 'training', target: '', text: 'Figma fundamentals (3-hour class at school)' })
    expect(a).toMatchObject({ kind: 'training', targetLabel: 'Training', text: 'Figma fundamentals (3-hour class at school)' })
  })
  it('turns invented facts into a plain skill', () => {
    expect(guardAddition(resume, figma, { kind: 'training', target: '', text: 'Figma certification from Stanford, 40 hours' })).toMatchObject({ kind: 'skill', text: 'Figma' })
  })
  it('never lets "a little" read as expert', () => {
    expect(guardAddition(resume, figma, { kind: 'training', target: '', text: 'Advanced Figma class at school' })).toMatchObject({ kind: 'skill' })
  })
  it('needs a real entry and the keyword for a bullet', () => {
    const yes: SkillAnswer = { keyword: 'prototyping', level: 'yes', note: 'did prototyping on ReWork, clickable prototypes before coding it' }
    expect(guardAddition(resume, yes, { kind: 'bullet', target: 'proj-1', text: 'Used prototyping on ReWork: built clickable prototypes before coding it' })).toMatchObject({ kind: 'bullet', target: 'proj-1', targetLabel: 'ReWork' })
    expect(guardAddition(resume, yes, { kind: 'bullet', target: 'nope', text: 'Built clickable prototypes' })).toMatchObject({ kind: 'skill' })
    expect(guardAddition(resume, yes, { kind: 'bullet', target: 'proj-1', text: 'Built mockups for ReWork' })).toMatchObject({ kind: 'skill' })
  })
  it('a bare yes is a skill in the named group', () => {
    expect(guardAddition(resume, { keyword: 'Sketch', level: 'yes', note: '' }, { kind: 'skill', target: 'design', text: 'Sketch' })).toMatchObject({ kind: 'skill', target: 'Design' })
  })
})

describe('placeSkills', () => {
  it('skips the model for answers with no note', async () => {
    const out = await placeSkills(resume, [{ keyword: 'Sketch', level: 'yes', note: '' }], { route: { provider: 'anthropic', model: 'never-called' } })
    expect(out).toEqual(fallbackAdditions(resume, [{ keyword: 'Sketch', level: 'yes', note: '' }]))
  })
})

describe('applySkillAdditions', () => {
  it('adds skills, bullets and a Training section once each', () => {
    const additions = [
      { keyword: 'Sketch', kind: 'skill' as const, target: 'Design', targetLabel: 'Skills: Design', text: 'Sketch' },
      { keyword: 'React', kind: 'skill' as const, target: 'Design', targetLabel: '', text: 'react' },
      { keyword: 'prototyping', kind: 'bullet' as const, target: 'proj-1', targetLabel: 'ReWork', text: 'Used prototyping on ReWork before coding it' },
      { keyword: 'Figma', kind: 'training' as const, target: '', targetLabel: 'Training', text: 'Figma fundamentals (3-hour class)' },
    ]
    const { resume: next, applied } = applySkillAdditions(resume, [...additions, additions[3]])
    expect(applied).toBe(3)
    expect(next.skills[1].items).toEqual(['UX flows', 'Sketch'])
    expect(next.projects[0].bullets).toHaveLength(2)
    expect(next.extraSections).toEqual([{ heading: 'Training', items: ['Figma fundamentals (3-hour class)'] }])
    expect(resume.extraSections).toEqual([]) // the input is untouched
    expect(fitCoverage(['Figma', 'Sketch', 'prototyping'], next).score).toBe(100)
  })
})
