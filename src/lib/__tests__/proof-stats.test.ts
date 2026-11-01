import { describe, expect, it } from 'vitest'
import { toApplicationDetail } from '@/lib/application-dto'
import { MIN_MATCHED, sumReceipts } from '@/lib/proof-stats'

// A saved result as the proof loader selects it.
const row = (suggestions: Record<string, unknown>, scores: Record<string, unknown> | null = { keywordCoverageMaster: 25, keywordCoverageTailored: 75 }) =>
  toApplicationDetail({
    id: 'a', resumeId: 'r', jobTitle: 'Data Engineer', company: 'Acme', jobUrl: null, createdAt: new Date(0),
    matchScore: 75, categoryScores: scores, keywords: [], suggestions,
  })

const report = {
  targetKeywords: ['sql', 'python', 'airflow', 'dbt'],
  missingKeywords: ['dbt'],
  presentBefore: ['sql'],
  presentAfter: ['sql', 'python', 'airflow'],
  changes: [{ status: 'accepted' }, { status: 'accepted' }, { status: 'reverted' }],
  warnings: [
    { type: 'new_number', section: 'roles', attempted: 'Grew revenue 40%' },
    { type: 'entry_restored', section: 'roles', attempted: 'kept' },
    { type: 'new_claim', section: 'summary', attempted: '   ' },
  ],
}

describe('sumReceipts', () => {
  it('adds up the receipts the Result card shows', () => {
    const rows = Array.from({ length: MIN_MATCHED }, () => row(report))
    expect(sumReceipts(rows, 12)).toEqual({
      tailors: 12,
      kept: 2 * MIN_MATCHED,
      keywordsAdded: 2 * MIN_MATCHED,
      leftOut: MIN_MATCHED,
      match: { before: 25, after: 75 },
      invented: 0,
    })
  })

  it('counts nothing it can not back up for older results', () => {
    const old = row({ ...report, presentBefore: undefined }, null)
    const stats = sumReceipts([old], 1)
    expect(stats.kept).toBe(2)
    expect(stats.keywordsAdded).toBe(0)
    expect(stats.match).toBeNull()
  })

  it('hides the average match until there are enough results', () => {
    const rows = Array.from({ length: MIN_MATCHED - 1 }, () => row(report))
    expect(sumReceipts(rows, MIN_MATCHED).match).toBeNull()
  })

  it('is all zeros with no results', () => {
    expect(sumReceipts([], 0)).toEqual({ tailors: 0, kept: 0, keywordsAdded: 0, leftOut: 0, match: null, invented: 0 })
  })
})
