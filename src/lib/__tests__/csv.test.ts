import { describe, expect, it } from 'vitest'
import { csvField } from '@/lib/csv'

describe('csvField', () => {
  it('quotes and doubles embedded quotes', () => {
    expect(csvField('Jane "JJ" Doe')).toBe('"Jane ""JJ"" Doe"')
    expect(csvField(null)).toBe('""')
    expect(csvField(3)).toBe('"3"')
  })

  it('defuses formulas', () => {
    for (const v of ['=HYPERLINK("http://x")', '+1', '-2+3', '@SUM(A1)', '\tx']) {
      expect(csvField(v).startsWith(`"'`)).toBe(true)
    }
    expect(csvField('jane@x.io')).toBe('"jane@x.io"')
  })
})
