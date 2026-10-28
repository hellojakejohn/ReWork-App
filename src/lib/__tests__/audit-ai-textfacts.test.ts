// Audit (launch-audit branch): adversarial tests for the prose fact guard used by cover
// letters and evidence rewrites (src/lib/text-facts.ts). `it.fails` = the invented fact
// slips through today; the comment says what should happen.
import { describe, expect, it } from 'vitest'
import { dropUnsupportedSentences, unsupportedFacts } from '@/lib/text-facts'

const allowed = [
  'Restaurant manager with 6 years of experience.',
  'Managed a team of 8 servers and cooks at Blue Door Bistro.',
  'Grew catering revenue by 30% in one year.',
  'Processed $1.2M in annual sales. Ran 50 catering events a year.',
  'Excel, Scheduling, Inventory',
].join('\n')

const flagged = (sentence: string) => {
  const f = unsupportedFacts(sentence, allowed)
  return f.numbers.length + f.terms.length > 0
}

describe('prose guard: things it catches (baseline)', () => {
  it('new digits and spelled-out numbers from three up', () => {
    expect(flagged('I led a team of 12 at Blue Door Bistro.')).toBe(true)
    expect(flagged('I grew bookings by twenty percent.')).toBe(true)
    expect(flagged('I trained five new managers.')).toBe(true)
  })
  it('invented employer or tool mid-sentence', () => {
    expect(flagged('Before that I worked at Google.')).toBe(true)
    expect(flagged('I built dashboards in Tableau.')).toBe(true)
    expect(flagged('I hold a PMP.')).toBe(true)
  })
  it('drops only the sentence that carries the invented fact', () => {
    const r = dropUnsupportedSentences('I managed 8 people at Blue Door Bistro. I also ran Tableau reports.', allowed)
    expect(r.text).toBe('I managed 8 people at Blue Door Bistro.')
  })
})

describe('prose guard: misses', () => {
  // Should flag: "doubled"/"tripled"/"halved"/"twice" are metrics.
  it.fails('"doubled" is flagged', () => {
    expect(flagged('I doubled catering revenue.')).toBe(true)
  })
  it.fails('"twice" is flagged', () => {
    expect(flagged('I was promoted twice.')).toBe(true)
  })
  // "one" and "two" are skipped on purpose (idioms), and "a dozen" (singular) is missing
  // from WORD_NUMBERS. Should flag the clear count forms.
  it.fails('"two promotions" is flagged', () => {
    expect(flagged('I earned two promotions in a year.')).toBe(true)
  })
  it.fails('"a dozen" is flagged', () => {
    expect(flagged('I opened a dozen new accounts.')).toBe(true)
  })
  // Should flag: the capitalized-word rule skips the FIRST word of a sentence, so a tool or
  // employer that starts a sentence is invisible.
  it.fails('an invented tool at the start of a sentence is flagged', () => {
    expect(flagged('Salesforce was part of my daily work.')).toBe(true)
  })
  it.fails('an invented employer at the start of a sentence is flagged', () => {
    expect(flagged('Sysco trained me on supplier contracts.')).toBe(true)
  })
  // Should flag: lowercase tool names have no "name shape".
  it.fails('a lowercase tool name is flagged', () => {
    expect(flagged('I automated ordering with python scripts.')).toBe(true)
  })
  // Caught here (the word "million" is its own number), unlike the tailor guard.
  it('"$8 million" borrowing the 8 is flagged', () => {
    expect(flagged('I oversaw $8 million in purchasing.')).toBe(true)
  })
  // Should flag: digits outside ASCII are invisible.
  it.fails('fullwidth digits are flagged', () => {
    expect(flagged('I cut waste by ９０%.')).toBe(true)
  })
})
