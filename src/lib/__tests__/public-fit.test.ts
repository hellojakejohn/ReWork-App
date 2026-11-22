import { describe, expect, it } from 'vitest'
import { cachedKeywords, jobKey, publicFit, rememberKeywords, verdictFor } from '@/lib/public-fit'

describe('public fit', () => {
  it('scores a resume against the job keywords and names a verdict', () => {
    const fit = publicFit(['vendor management', 'scheduling', 'Excel', 'work order systems'], 'Managed scheduling for 28 staff. Weekly reports in Excel. Vendor management for 5 suppliers.')
    expect(fit.present).toEqual(expect.arrayContaining(['scheduling', 'Excel', 'vendor management']))
    expect(fit.missing).toEqual(['work order systems'])
    expect(fit.score).toBeGreaterThan(50)
    expect(fit.verdict).toBe(verdictFor(fit.score))
  })

  it('maps scores to tailor verdicts', () => {
    expect(verdictFor(85)).toBe('tailored')
    expect(verdictFor(55)).toBe('close')
    expect(verdictFor(35)).toBe('alterations')
    expect(verdictFor(10)).toBe('rework')
  })

  it('caches keywords by the job text, ignoring spacing and case', () => {
    const a = jobKey('Operations Coordinator\n\nWe need   scheduling.')
    const b = jobKey('operations coordinator we need scheduling.')
    expect(a).toBe(b)
    expect(cachedKeywords(a)).toBeNull()
    rememberKeywords(a, ['scheduling'])
    expect(cachedKeywords(b)).toEqual(['scheduling'])
  })
})
