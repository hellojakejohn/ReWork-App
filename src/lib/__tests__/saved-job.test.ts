import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanSavedJob, SAVED_JOB_KEY, SAVED_JOB_MAX_AGE_MS, savedJobFromHash, storeSavedJob, takeSavedJob } from '@/lib/saved-job'
import { saveJobBookmarklet, saveJobScript } from '@/lib/save-job-script'

const description = 'Design core product flows for traders. '.repeat(5)
const job = { url: 'https://www.linkedin.com/jobs/view/123/', title: 'Product Designer', company: 'Acme', location: 'Remote', description }

describe('savedJobFromHash', () => {
  it('reads the job the script sends', () => {
    expect(savedJobFromHash(`#job=${encodeURIComponent(JSON.stringify(job))}`)).toEqual({ ...job, description: description.trim() })
  })
  it('ignores junk', () => {
    expect(savedJobFromHash('')).toBeNull()
    expect(savedJobFromHash('#job=%E0%A4%A')).toBeNull()
    expect(savedJobFromHash('#job=' + encodeURIComponent('"text"'))).toBeNull()
    expect(savedJobFromHash('#other=1')).toBeNull()
  })
})

describe('cleanSavedJob', () => {
  it('keeps strings only, caps them, and drops non-http links', () => {
    const cleaned = cleanSavedJob({ ...job, title: 'x'.repeat(500), company: 42, url: 'javascript:alert(1)' })
    expect(cleaned?.title).toHaveLength(200)
    expect(cleaned?.company).toBe('')
    expect(cleaned?.url).toBe('')
  })
  it('needs a real description', () => {
    expect(cleanSavedJob({ ...job, description: 'short' })).toBeNull()
  })
})

describe('store and take', () => {
  const store = new Map<string, string>()
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('hands the job over once', () => {
    storeSavedJob(job, 1000)
    expect(takeSavedJob(2000)?.title).toBe('Product Designer')
    expect(store.has(SAVED_JOB_KEY)).toBe(false)
    expect(takeSavedJob(2000)).toBeNull()
  })
  it('keeps the posting facts through sign-in', () => {
    storeSavedJob({ ...job, facts: { posted: 'Reposted 3 weeks ago', applicants: 'Over 100 applicants', pay: true } }, 1000)
    expect(takeSavedJob(2000)?.facts).toEqual({ posted: 'Reposted 3 weeks ago', applicants: 'Over 100 applicants', pay: true })
  })
  it('drops a stale one', () => {
    storeSavedJob(job, 0)
    expect(takeSavedJob(SAVED_JOB_MAX_AGE_MS + 1)).toBeNull()
  })
})

describe('the bookmarklet', () => {
  it('is valid one-line JavaScript for the given origin', () => {
    const href = saveJobBookmarklet('https://rework.hellojakejohn.com')
    expect(href.startsWith('javascript:')).toBe(true)
    const code = decodeURIComponent(href.slice('javascript:'.length))
    expect(code).not.toContain('\n')
    expect(code).toContain('"https://rework.hellojakejohn.com"')
    expect(() => new Function(code)).not.toThrow()
  })
  it('cannot be given an origin that breaks out of the string', () => {
    expect(saveJobScript('https://x.com";alert(1);"')).toContain('"https://x.comalert1"')
  })
})

// Runs the real script against a stand-in page: selector -> element texts, nothing else.
function runOnPage(href: string, title: string, bySelector: Record<string, string[]>, jsonLd?: object) {
  const el = (t: string) => ({ innerText: t, textContent: t, parentElement: null, querySelector: () => null })
  const document = {
    title,
    body: {},
    querySelectorAll: (sel: string) =>
      sel === 'script[type="application/ld+json"]' ? (jsonLd ? [el(JSON.stringify(jsonLd))] : []) : (bySelector[sel] || []).map(el),
    querySelector: (sel: string) => (bySelector[sel] ? el(bySelector[sel][0]) : null),
  }
  const url = new URL(href)
  const location = { href, hostname: url.hostname, pathname: url.pathname, search: url.search, origin: url.origin }
  let opened = ''
  const window = { getSelection: () => '', open: (t: string) => ((opened = t), {}), chrome: undefined }
  new Function('document', 'location', 'window', 'alert', 'URLSearchParams', saveJobScript('https://rework.test'))(document, location, window, () => {}, URLSearchParams)
  return savedJobFromHash(new URL(opened).hash)
}

describe('the script on a page', () => {
  const long = 'Lead design for the trading app and run research with customers every week. '.repeat(4)
  it('reads LinkedIn posting age, repost and applicant count', () => {
    const job = runOnPage('https://www.linkedin.com/jobs/view/4012345/', 'Product Designer | Acme | LinkedIn', {
      '.job-details-jobs-unified-top-card__job-title h1': ['Product Designer'],
      '.job-details-jobs-unified-top-card__company-name a': ['Acme'],
      '.job-details-jobs-unified-top-card__primary-description-container': ['Saint Paul, MN · Reposted 3 weeks ago · Over 100 applicants'],
      '#job-details': [long],
    })
    expect(job).toMatchObject({ title: 'Product Designer', company: 'Acme', facts: { posted: 'Reposted 3 weeks ago', applicants: 'Over 100 applicants' } })
  })
  it('reads JSON-LD dates and pay on any job page', () => {
    const job = runOnPage('https://careers.acme.example/jobs/1', 'Analyst', {}, {
      '@type': 'JobPosting',
      title: 'Analyst',
      hiringOrganization: { name: 'Acme' },
      description: long,
      datePosted: '2026-07-01',
      validThrough: '2026-09-30',
      baseSalary: { currency: 'USD' },
    })
    expect(job?.facts).toEqual({ posted: '2026-07-01T00:00:00.000Z', closes: '2026-09-30T00:00:00.000Z', pay: true })
  })
  it('drops facts that are not what they claim', () => {
    expect(cleanSavedJob({ ...job, posted: 'Saint Paul, MN', applicants: 'lots', closes: 'soon', pay: 'maybe' })?.facts).toBeUndefined()
  })
})
