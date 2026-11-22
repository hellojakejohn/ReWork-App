import { describe, expect, it } from 'vitest'
import { LANDING_EXAMPLE as EX, highlightParts } from '@/components/site/landing-example'

describe('landing example', () => {
  it('invents nothing: every number in a rewrite is in the original resume', () => {
    const rows = [EX.summary, ...EX.bullets]
    const original = rows.map((r) => r.before).join(' ')
    for (const row of rows) {
      for (const n of row.after.match(/\d+(\.\d+)?/g) ?? []) expect(original).toContain(n)
    }
  })

  it('highlights only words that are really in the rewrite', () => {
    for (const row of [EX.summary, ...EX.bullets]) {
      for (const w of row.jobWords) expect(row.after.toLowerCase()).toContain(w.toLowerCase())
    }
  })

  it('has no em-dashes', () => {
    expect(JSON.stringify(EX)).not.toContain('—')
  })
})

describe('highlightParts', () => {
  it('splits around the words, case-insensitive, without overlaps', () => {
    expect(highlightParts('Coordinated purchasing with 5 vendors.', ['vendors', 'coordinated'])).toEqual([
      { text: 'Coordinated', hit: true },
      { text: ' purchasing with 5 ', hit: false },
      { text: 'vendors', hit: true },
      { text: '.', hit: false },
    ])
    expect(highlightParts('abc', [])).toEqual([{ text: 'abc', hit: false }])
  })
})
