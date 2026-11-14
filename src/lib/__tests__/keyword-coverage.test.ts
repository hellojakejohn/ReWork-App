// Keyword coverage matching: plurals, slash families and either-or terms count.
import { describe, expect, it } from 'vitest'
import { keywordCoverage, keywordWeight, root, stem } from '@/lib/keyword-coverage'

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

describe('REST naming', () => {
  it('reads RESTful and REST APIs as the same skill', () => {
    expect(keywordCoverage(['RESTful', 'RESTful APIs'], 'Built REST APIs for partners.').missing).toEqual([])
    expect(keywordCoverage(['REST APIs'], 'Designed RESTful APIs.').missing).toEqual([])
    expect(keywordCoverage(['RESTful'], 'Rested on weekends.').missing).toEqual(['RESTful'])
  })
})

describe('weighted score', () => {
  it('counts the first keyword double the last', () => {
    expect([0, 1, 2].map((i) => keywordWeight(i, 3))).toEqual([1, 0.75, 0.5])
    expect(keywordCoverage(['TypeScript', 'Kubernetes'], 'TypeScript').score).toBe(67)
    expect(keywordCoverage(['Kubernetes', 'TypeScript'], 'TypeScript').score).toBe(33)
    expect(keywordCoverage(['TypeScript'], 'TypeScript').score).toBe(100)
  })
})

describe('other words for career changers', () => {
  const restaurant = [
    'Ran weekly inventory and ordering with 5 food and beverage vendors',
    'Reconciled nightly cash and processed vendor invoices',
    'Scheduled shifts for 15 staff using 7shifts',
    'Wrote the training manual used to onboard new servers and hosts',
    'Managed a staff of 28 across front and back of house',
  ].join('\n')

  it('shares a root across word forms', () => {
    expect(root('management')).toBe(root('managed'))
    expect(root('processing')).toBe(root('processed'))
    expect(root('coordination')).toBe(root('coordinated'))
    expect(root('documentation')).toBe(root('documented'))
    expect(root('scheduling')).toBe(root('schedules'))
    expect(root('communication')).not.toBe(root('community'))
    expect(root('nation').length).toBeGreaterThanOrEqual(4)
  })

  it('finds the same words in another order or form, in one line', () => {
    const c = keywordCoverage(['Invoice Processing', 'Staff Scheduling', 'Staff Management'], restaurant)
    expect(c.related).toEqual(['Invoice Processing', 'Staff Scheduling', 'Staff Management'])
  })

  it('reads "ran X" as X management', () => {
    expect(keywordCoverage(['Inventory Management'], restaurant).related).toEqual(['Inventory Management'])
    expect(keywordCoverage(['Vendor Coordination'], 'Coordinated repairs with HVAC vendors').related).toEqual(['Vendor Coordination'])
  })

  it('does not join words from different lines or far apart', () => {
    expect(keywordCoverage(['Budget Management'], 'Managed a staff of 28\nTracked the budget').missing).toEqual(['Budget Management'])
    expect(keywordCoverage(['Data Processing'], 'Processed vendor invoices every week for the owners and wrote data reports').missing).toEqual(['Data Processing'])
    expect(keywordCoverage(['Project Management'], 'Managed a staff of 28. Shipped a project').missing).toEqual(['Project Management'])
  })

  it('keeps meaning-only matches missing: those need the person to say so', () => {
    const c = keywordCoverage(['Customer Service', 'Property Management', 'Work Orders'], restaurant)
    expect(c.missing).toEqual(['Customer Service', 'Property Management', 'Work Orders'])
  })

  it('leaves exact words as present', () => {
    expect(keywordCoverage(['vendors'], restaurant).present).toEqual(['vendors'])
  })
})
