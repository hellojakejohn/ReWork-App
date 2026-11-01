// Results saved before a matcher change are re-scored when opened, so they don't show stale
// "missing" lists (the Nov 1 Trane result listed Front-end with "frontends" on the resume).
import { describe, expect, it } from 'vitest'
import { toApplicationDetail } from '@/lib/application-dto'

const original = {
  professionalSummary: 'Full-stack engineer: React and Next.js frontends, Node.js and PostgreSQL backends.',
  workExperience: [{ id: 'r1', jobTitle: 'Founding Engineer', company: 'TripQuest Inc.', achievements: ['Own the architecture end to end'] }],
  skills: { technical: ['TypeScript', 'React'] },
}
const optimized = {
  targetKeywords: ['TypeScript', 'Front-End', 'SQL', 'Kubernetes'],
  summary: 'Full-stack engineer: React and Next.js front-end, Node.js and PostgreSQL backends.',
  roles: [{ id: 'r1', title: 'Founding Engineer', company: 'TripQuest Inc.', startDate: '', endDate: '', bullets: [{ text: 'Own the architecture end to end', reason: '' }] }],
  education: [],
  projects: [],
  skills: ['TypeScript', 'React'],
}
const row = {
  id: 'a1', resumeId: 'm1', jobTitle: 'Dev', company: 'Acme', jobUrl: null, createdAt: new Date('2026-11-01'),
  matchScore: 25, categoryScores: { keywordCoverageMaster: 25, keywordCoverageTailored: 25 },
  keywords: optimized.targetKeywords,
  // Stale report from the old literal matcher.
  suggestions: { version: 'tailor-v3', model: 'x', warnings: [], bulletReasons: {}, targetKeywords: optimized.targetKeywords, missingKeywords: ['Front-End', 'SQL', 'Kubernetes'], presentBefore: ['TypeScript'], presentAfter: ['TypeScript'], changes: [] },
  originalContent: original,
  optimizedContent: optimized,
}

describe('toApplicationDetail re-scores stored results', () => {
  it('replaces a stale missing list with today\'s three groups', () => {
    const d = toApplicationDetail(row)
    expect(d.keywords.presentAfter).toEqual(['TypeScript', 'Front-End'])
    expect(d.keywords.related).toEqual(['SQL'])
    expect(d.keywords.missing).toEqual(['Kubernetes'])
    expect(d.coverageAfter).toBeGreaterThan(d.coverageBefore!)
  })
  it('falls back to the stored report when the row has no contents', () => {
    const d = toApplicationDetail({ ...row, originalContent: undefined, optimizedContent: undefined })
    expect(d.keywords.missing).toEqual(['Front-End', 'SQL', 'Kubernetes'])
    expect(d.coverageAfter).toBe(25)
  })
})
