import { describe, expect, it } from 'vitest'
import { buildReceipt, REAL_NUMBER_QUESTION } from '@/lib/receipt'
import type { FactGuardWarning } from '@/types/tailor'

const base = {
  changes: [],
  keywords: { presentBefore: [], presentAfter: [] },
  coverageBefore: null,
  warnings: [] as FactGuardWarning[],
}

describe('buildReceipt', () => {
  it('counts only accepted changes as kept', () => {
    const r = buildReceipt({ ...base, changes: [{ status: 'accepted' }, { status: 'reverted' }, { status: 'accepted' }] })
    expect(r.kept).toBe(2)
  })

  it('counts keywords the master did not cover', () => {
    const r = buildReceipt({
      ...base,
      keywords: { presentBefore: ['SQL'], presentAfter: ['SQL', 'Kubernetes', 'GitHub Actions'] },
      coverageBefore: 20,
    })
    expect(r.keywordsAdded).toBe(2)
    expect(r.keywordsAddedList).toEqual(['Kubernetes', 'GitHub Actions'])
  })

  it('reports keywords added as unknown for results saved before coverage was recorded', () => {
    const r = buildReceipt({ ...base, keywords: { presentBefore: [], presentAfter: ['SQL'] }, coverageBefore: 40 })
    expect(r.keywordsAdded).toBeNull()
  })

  it('a master that covered nothing makes every covered keyword new', () => {
    const r = buildReceipt({ ...base, keywords: { presentBefore: [], presentAfter: ['SQL', 'Go'] }, coverageBefore: 0 })
    expect(r.keywordsAdded).toBe(2)
  })

  it('lists one left-out claim per fact-guard removal, and none for restored entries', () => {
    const warnings: FactGuardWarning[] = [
      {
        type: 'new_number',
        section: 'roles',
        id: 'role-0',
        message: 'Bullet introduced numbers not in your resume (40%); reverted to your original bullet.',
        attempted: 'Increased revenue by 40%',
        restored: 'Increased revenue',
      },
      { type: 'skill_dropped', section: 'skills', message: 'Dropped', attempted: 'Rust, Go' },
      { type: 'entry_restored', section: 'roles', id: 'role-1', message: 'Restored', restored: 'Engineer at Acme' },
      { type: 'entry_discarded', section: 'roles', message: 'Discarded', attempted: 'CTO at Initech' },
    ]
    const r = buildReceipt({ ...base, warnings })
    expect(r.leftOut.map((c) => c.claim)).toEqual(['Increased revenue by 40%', 'Rust, Go', 'CTO at Initech'])
    expect(r.restored).toBe(1)
    expect(r.invented).toBe(0)
  })

  it('offers "Add it" only for a number taken out of a bullet the master still has', () => {
    const warnings: FactGuardWarning[] = [
      { type: 'new_number', section: 'roles', id: 'role-0', message: '', attempted: 'Cut costs 30%', restored: 'Cut costs' },
      { type: 'new_number', section: 'roles', id: 'role-0', message: '', attempted: 'Saved $2M' }, // removed, no original
      { type: 'new_number', section: 'summary', message: '', attempted: '10 years of Go', restored: 'Years of Go' },
    ]
    const [withOriginal, removed, summary] = buildReceipt({ ...base, warnings }).leftOut
    expect(withOriginal.evidence).toEqual({ section: 'roles', entryId: 'role-0', bullet: 'Cut costs' })
    expect(withOriginal.question).toBe(REAL_NUMBER_QUESTION)
    expect(removed.evidence).toBeNull()
    expect(summary.evidence).toBeNull()
  })

  it('ignores warnings with no attempted text', () => {
    const r = buildReceipt({ ...base, warnings: [{ type: 'new_number', section: 'roles', id: 'r', message: '' }] })
    expect(r.leftOut).toHaveLength(0)
  })
})
