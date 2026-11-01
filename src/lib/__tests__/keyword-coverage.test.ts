// Keyword coverage matching: plurals, slash families and either-or terms count.
import { describe, expect, it } from 'vitest'
import { keywordCoverage, stem } from '@/lib/keyword-coverage'

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

// The Trane run (Nov 1): these were all shown as "not in your resume".
describe('keywordCoverage word forms and implications', () => {
  const resume = `Full-stack engineer who designs and ships production web and mobile applications end to end in
TypeScript: React and Next.js frontends, React Native mobile, Node.js and PostgreSQL backends, and AI pipelines.
Verifies work through tests, deployments, and monitoring. Owns the code-review layer. Shipped with GitHub Actions on AWS.`

  it('reads hyphenated, joined and split compounds the same', () => {
    const c = keywordCoverage(['Front-End', 'Back-End', 'Frontend', 'front end', 'Full Stack', 'Code Review'], resume)
    expect(c.missing).toEqual([])
  })

  it('reads word endings: tests shows Testing and Unit Testing only when "unit" is there', () => {
    expect(keywordCoverage(['Testing'], resume).missing).toEqual([])
    expect(keywordCoverage(['Unit Testing'], resume).missing).toEqual(['Unit Testing'])
    expect(keywordCoverage(['Unit Testing'], 'Wrote unit tests for every route.').missing).toEqual([])
    expect(keywordCoverage(['Debugging'], 'Debugged flaky payments.').missing).toEqual([])
  })

  it('reads "web and mobile applications" as Web Applications and Mobile Applications', () => {
    expect(keywordCoverage(['Web Applications', 'Mobile Applications'], resume).missing).toEqual([])
    expect(keywordCoverage(['Web Applications'], 'web servers and mobile games').missing).toEqual(['Web Applications'])
  })

  it('counts honest implications only', () => {
    const c = keywordCoverage(['SQL', 'Relational Databases', 'Databases', 'JavaScript', 'Cloud', 'CI/CD'], resume)
    expect(c.missing).toEqual([])
    const none = keywordCoverage(['SQL', 'NoSQL', 'JavaScript', 'Cloud', 'CI/CD'], 'Python and Excel on a laptop.')
    expect(none.present).toEqual([])
  })

  it('keeps whole-word matching for short and unrelated terms', () => {
    const c = keywordCoverage(['React', 'Java', 'REST APIs', 'Software Architecture', 'Agile'], 'Reactive JavaScript work on architecture.')
    expect(c.present).toEqual([])
  })
})

describe('stem', () => {
  it('normalizes common endings and leaves short words', () => {
    expect(['test', 'tests', 'testing', 'tested'].map(stem)).toEqual(['test', 'test', 'test', 'test'])
    expect(['databases', 'technologies', 'processes', 'apis', 'api', 'go'].map(stem)).toEqual(['database', 'technology', 'process', 'api', 'api', 'go'])
    expect(stem('running')).toBe('run')
  })
})
