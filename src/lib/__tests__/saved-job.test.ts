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
