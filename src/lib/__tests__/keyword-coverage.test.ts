// Keyword coverage matching: plurals, slash families and either-or terms count.
import { describe, expect, it } from 'vitest'
import { keywordCoverage } from '@/lib/keyword-coverage'

describe('keywordCoverage', () => {
  const text = 'Skills: ERC-20/721/1155, Permit2. Wrote knowledge bases and reproducible bug reports. Used curl daily.'

  it('counts plurals, slash families and either-or terms', () => {
    const c = keywordCoverage(['Knowledge base', 'ERC-721', 'ERC-1155', 'Bug report', 'Postman / curl'], text)
    expect(c.missing).toEqual([])
    expect(c.score).toBe(100)
  })

  it('still misses what is not there, and keeps whole-term matching', () => {
    const c = keywordCoverage(['ERC-4626', 'Python', 'Perm', 'Java'], `${text} JavaScript`)
    expect(c.present).toEqual([])
    expect(c.score).toBe(0)
  })
})
