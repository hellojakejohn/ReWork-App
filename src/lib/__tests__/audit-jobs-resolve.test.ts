// Launch audit: the job URL resolver chain with a mocked fetcher and model (no network).
// it.fails = proven bug; the comment says what correct behavior is.
import { describe, expect, it, vi } from 'vitest'
import { resolveJob, LinkedInUrlError, type FetchedPage, type ResolveDeps } from '@/lib/job-resolve'
import { matchAtsUrl } from '@/lib/job-resolve/ats'
import { extractJsonLdJob } from '@/lib/job-resolve/json-ld'
import { UnsafeUrlError, FetchTimeoutError } from '@/lib/safe-fetch'
import { INPUT_LIMITS } from '@/lib/plans'

const LONG_JOB = Array.from({ length: 20 }, (_, i) => `<li>Responsibility ${i}: build and run reliable services for our customers.</li>`).join('')
const jobHtml = (body: string, head = '') => `<html><head><title>Job</title>${head}</head><body>${body}</body></html>`
const page = (text: string, status = 200, url = 'https://x.io/'): FetchedPage => ({ status, url, text })

function deps(fetchImpl: ResolveDeps['fetchPage'], model?: ResolveDeps['extractWithModel']) {
  const fetchPage = vi.fn(fetchImpl)
  return { fetchPage, deps: { fetchPage, extractWithModel: model } as ResolveDeps }
}

const quiet = () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
}

describe('LinkedIn is never fetched', () => {
  it.each([
    'https://www.linkedin.com/jobs/view/1234567890/',
    'https://linkedin.com/jobs/view/1234567890',
    'https://www.linkedin.com/comm/jobs/view/1234567890?trk=email',
    'https://uk.linkedin.com/jobs/view/senior-engineer-at-acme-1234567890',
    'https://de.linkedin.com/jobs/view/1',
    'https://WWW.LINKEDIN.COM/jobs/view/1',
    'https://www.linkedin.com./jobs/view/1',
    'https://lnkd.in/gAbCdEf',
    'https://www.linkedin.cn/jobs/view/1',
  ])('%s -> needsPaste linkedin, zero fetches', async (url) => {
    const { fetchPage, deps: d } = deps(async () => page(''))
    const result = await resolveJob(new URL(url).href, d)
    expect(result).toMatchObject({ ok: false, reason: 'linkedin' })
    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('a non-LinkedIn URL that redirects to LinkedIn -> needsPaste linkedin (fetcher throws LinkedInUrlError)', async () => {
    const { deps: d } = deps(async () => {
      throw new LinkedInUrlError()
    })
    expect(await resolveJob('https://bit.ly/abc', d)).toMatchObject({ ok: false, reason: 'linkedin' })
  })

  it('"linkedin" only in the path or query is not treated as LinkedIn', async () => {
    const { fetchPage, deps: d } = deps(async () => page('', 404))
    await resolveJob('https://example.com/jobs?from=linkedin.com', d)
    expect(fetchPage).toHaveBeenCalled()
  })
})

describe('bot-blocked sites', () => {
  it.each([
    ['https://www.indeed.com/viewjob?jk=abc', 'Indeed'],
    ['https://uk.indeed.com/viewjob?jk=abc', 'Indeed'],
    ['https://www.indeed.co.uk/viewjob?jk=abc', 'Indeed'],
    ['https://www.glassdoor.com/job-listing/x', 'Glassdoor'],
    ['https://www.glassdoor.co.uk/job-listing/x', 'Glassdoor'],
  ])('%s -> blocked_site (%s), not fetched', async (url, site) => {
    const { fetchPage, deps: d } = deps(async () => page(''))
    const result = await resolveJob(url, d)
    expect(result).toMatchObject({ ok: false, reason: 'blocked_site' })
    expect((result as { message: string }).message).toContain(site)
    expect(fetchPage).not.toHaveBeenCalled()
  })
})

describe('ATS URL matching', () => {
  it.each([
    ['https://boards.greenhouse.io/acme/jobs/4012345', 'https://boards-api.greenhouse.io/v1/boards/acme/jobs/4012345'],
    ['https://job-boards.greenhouse.io/acme/jobs/4012345', 'https://boards-api.greenhouse.io/v1/boards/acme/jobs/4012345'],
    ['https://boards.greenhouse.io/embed/job_app?for=acme&token=4012345', 'https://boards-api.greenhouse.io/v1/boards/acme/jobs/4012345'],
    ['https://jobs.lever.co/acme/0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0/apply', 'https://api.lever.co/v0/postings/acme/0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0'],
    ['https://jobs.eu.lever.co/acme/0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0', 'https://api.eu.lever.co/v0/postings/acme/0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0'],
    ['https://jobs.ashbyhq.com/acme/0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0', 'https://api.ashbyhq.com/posting-api/job-board/acme?includeCompensation=true'],
    ['https://acme.wd5.myworkdayjobs.com/en-US/External/job/Minneapolis-MN/Engineer_R123', 'https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/job/Minneapolis-MN/Engineer_R123'],
    ['https://acme.wd1.myworkdayjobs.com/Careers/job/Remote/Engineer_JR-99', 'https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/Careers/job/Remote/Engineer_JR-99'],
    ['https://jobs.smartrecruiters.com/Acme/743999912345678-senior-engineer', 'https://api.smartrecruiters.com/v1/companies/Acme/postings/743999912345678'],
  ])('%s', (url, api) => {
    expect(matchAtsUrl(url)?.apiUrl).toBe(api)
  })

  // Correct behavior: company career pages that embed Greenhouse ("acme.com/careers?gh_jid=123")
  // resolve through the Greenhouse API (board token is in the page's
  // boards.greenhouse.io/embed/job_board/js?for=<board> script). Today the page is fetched,
  // the job loads in an iframe, and the model reads the generic careers page: "not a job",
  // or worse, the first job listed on it.
  it.fails('?gh_jid= on a company site uses the Greenhouse API', async () => {
    const html = jobHtml(
      `<main><h1>Careers at Acme</h1><p>${'We are hiring across many teams. '.repeat(20)}</p><div id="grnhse_app"></div></main><script src="https://boards.greenhouse.io/embed/job_board/js?for=acme"></script>`
    )
    const { fetchPage, deps: d } = deps(async (url) =>
      url.includes('boards-api.greenhouse.io') ? page(JSON.stringify({ title: 'Engineer', company_name: 'Acme', content: `&lt;ul&gt;${LONG_JOB}&lt;/ul&gt;` })) : page(html)
    )
    const result = await resolveJob('https://www.acme.com/careers?gh_jid=4012345', d)
    expect(fetchPage.mock.calls.some(([u]) => String(u).includes('boards-api.greenhouse.io/v1/boards/acme/jobs/4012345'))).toBe(true)
    expect(result).toMatchObject({ ok: true, job: { source: 'greenhouse' } })
  })

  // Correct behavior: Workday's newer "/details/" job URLs map to the same cxs endpoint
  // (/wday/cxs/{tenant}/{site}/job/{slug}). Today they fall through to the page, which
  // Workday renders client-side, so the user gets "loads with JavaScript, paste it".
  it('Workday /details/ URLs use the cxs API', () => {
    expect(matchAtsUrl('https://acme.wd1.myworkdayjobs.com/en-US/External/details/Senior-Engineer_R123')?.ats).toBe('workday')
  })

  it('ATS API failure (404, bad JSON, too large) falls back to the page', async () => {
    quiet()
    const { fetchPage, deps: d } = deps(async (url) => (url.includes('boards-api') ? page('<html>nope</html>', 200) : page('', 404)))
    const result = await resolveJob('https://boards.greenhouse.io/acme/jobs/1', d)
    expect(fetchPage).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({ ok: false, reason: 'unreachable' })
    vi.restoreAllMocks()
  })
})

describe('JSON-LD', () => {
  const posting = { '@type': 'JobPosting', title: 'Engineer', hiringOrganization: { name: 'Acme' }, description: `<ul>${LONG_JOB}</ul>` }
  const ld = (obj: unknown) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`

  it('@graph arrays', () => {
    const html = jobHtml('', ld({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite' }, posting] }))
    expect(extractJsonLdJob(html, 'https://x.io')?.title).toBe('Engineer')
  })

  it('arrays of types and top-level arrays', () => {
    const html = jobHtml('', ld([{ '@type': 'Organization' }, { ...posting, '@type': ['Thing', 'JobPosting'] }]))
    expect(extractJsonLdJob(html, 'https://x.io')?.company).toBe('Acme')
  })

  // Correct behavior: a JobPosting nested as a WebPage's mainEntity (a common CMS shape)
  // is found. flatten() only descends into @graph and arrays.
  it.fails('JobPosting nested under mainEntity', () => {
    const html = jobHtml('', ld({ '@type': 'WebPage', mainEntity: posting }))
    expect(extractJsonLdJob(html, 'https://x.io')?.title).toBe('Engineer')
  })
})

describe('dead links, loops, timeouts, challenge pages', () => {
  it.each([
    ['404', async () => page('Not found', 404), 'unreachable'],
    ['410', async () => page('Gone', 410), 'unreachable'],
    ['Cloudflare 403 "Just a moment..."', async () => page('<title>Just a moment...</title>', 403), 'blocked'],
    ['Cloudflare 503 challenge', async () => page('<title>Just a moment...</title>', 503), 'unreachable'],
    ['429', async () => page('', 429), 'blocked'],
    ['DNS failure', async () => Promise.reject(Object.assign(new Error('getaddrinfo ENOTFOUND nope.invalid'), { code: 'ENOTFOUND' })), 'unreachable'],
    ['redirect loop', async () => Promise.reject(new UnsafeUrlError('Too many redirects')), 'unreachable'],
    ['redirect to private IP', async () => Promise.reject(new UnsafeUrlError('x resolves to a non-public address')), 'unreachable'],
    ['timeout', async () => Promise.reject(new FetchTimeoutError()), 'unreachable'],
  ] as const)('%s -> needsPaste %s', async (_name, impl, reason) => {
    quiet()
    const model = vi.fn()
    const { deps: d } = deps(impl as ResolveDeps['fetchPage'], model)
    expect(await resolveJob('https://careers.example.com/job/1', d)).toMatchObject({ ok: false, reason })
    expect(model).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('a 200 "Just a moment..." challenge page is too short to reach the model', async () => {
    const model = vi.fn()
    const html = '<html><head><title>Just a moment...</title></head><body><h1>Checking your browser before accessing careers.example.com.</h1><p>Enable JavaScript and cookies to continue</p></body></html>'
    const { deps: d } = deps(async () => page(html), model)
    expect(await resolveJob('https://careers.example.com/job/1', d)).toMatchObject({ ok: false, reason: 'js_rendered' })
    expect(model).not.toHaveBeenCalled()
  })

  it('model says "not a job" for a news article -> not_a_job', async () => {
    const article = jobHtml(`<article><h1>Markets rally</h1><p>${'Stocks rose on Tuesday as investors weighed new data. '.repeat(20)}</p></article>`)
    const { deps: d } = deps(async () => page(article), async () => null)
    expect(await resolveJob('https://news.example.com/markets', d)).toMatchObject({ ok: false, reason: 'not_a_job' })
  })
})

describe('non-job pages when the model is unavailable or fails', () => {
  const article = jobHtml(
    `<article><h1>Markets rally</h1><p>${'Stocks rose on Tuesday as investors weighed new data. '.repeat(20)}</p></article>`,
    '<meta property="og:site_name" content="Daily News">'
  )

  // Correct behavior: with no model (provider key missing, or the user's AI is paused by the
  // cap) a page with no JobPosting JSON-LD and no ATS match goes to needsPaste. Today any page
  // with >= 300 chars of text is returned as a "job" (company = og:site_name), so a news
  // article, google.com or a 200 soft-404 becomes the job description that gets tailored to.
  it('no model: a news article is not returned as a job', async () => {
    const { deps: d } = deps(async () => page(article))
    expect(await resolveJob('https://news.example.com/markets', d)).toMatchObject({ ok: false })
  })

  // Correct behavior: a model error (timeout, overload, truncated output, refusal) means
  // needsPaste, not "use the page text as-is" (index.ts:127-143).
  it('model throws: the raw page is not returned as a job', async () => {
    quiet()
    const { deps: d } = deps(async () => page(article), async () => {
      throw new Error('overloaded')
    })
    const result = await resolveJob('https://news.example.com/markets', d)
    vi.restoreAllMocks()
    expect(result).toMatchObject({ ok: false })
  })

  // Correct behavior: a PDF (or any non-HTML content-type) at the URL is either extracted as
  // a PDF or sent to paste. FetchedPage carries no content-type, so the PDF's bytes are
  // decoded as UTF-8 and run through cheerio as if they were HTML.
  it('a PDF at the URL is not returned as a job description of PDF syntax', async () => {
    const stream = 'BT /F1 12 Tf 72 720 Td (Senior Engineer at Acme) Tj ET\n'.repeat(30)
    const pdf = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n%%EOF`
    const { deps: d } = deps(async () => page(pdf))
    const result = await resolveJob('https://acme.com/jobs/engineer.pdf', d)
    expect(result.ok && result.job.description.includes('%PDF')).toBe(false)
    expect(result).toMatchObject({ ok: false })
  })

  // Correct behavior: like the resume validator, the extracted description is checked
  // against the page text (most lines must appear in mainText). Today whatever the model
  // returns with isJobPosting=true is accepted, so a hallucinated description goes through.
  it.fails('a model description that is not on the page is rejected', async () => {
    const listing = jobHtml(`<main><h1>Open roles</h1><p>${'Engineering, Sales, Support and more. '.repeat(20)}</p></main>`)
    const { deps: d } = deps(async () => page(listing), async () => ({
      title: 'Staff Engineer',
      company: 'Acme',
      location: 'Remote',
      description: 'You will lead our Kubernetes platform team and own the 99.99% SLO for payments.',
    }))
    expect(await resolveJob('https://acme.com/careers', d)).toMatchObject({ ok: false })
  })
})

describe('long descriptions', () => {
  it('an ATS description over 20k chars is returned whole (the job card then blocks it with the 20k message)', async () => {
    const big = Array.from({ length: 400 }, (_, i) => `<li>Requirement ${i}: experience with distributed systems at scale.</li>`).join('')
    const { deps: d } = deps(async () => page(JSON.stringify({ title: 'Engineer', company_name: 'Acme', content: `<ul>${big}</ul>` })))
    const result = await resolveJob('https://boards.greenhouse.io/acme/jobs/1', d)
    expect(result.ok && result.job.description.length).toBeGreaterThan(INPUT_LIMITS.jobDescriptionChars)
  })

  it('the model path silently reads only the first 14,000 chars of page text (user not told)', async () => {
    const tail = 'REQUIREMENTS-AT-THE-END'
    const body = `<main>${'<p>About us and our mission statement goes here in detail.</p>'.repeat(300)}<p>${tail}</p></main>`
    const seen: string[] = []
    const { deps: d } = deps(async () => page(jobHtml(body)), async (meta) => {
      seen.push(meta.mainText)
      return null
    })
    await resolveJob('https://acme.com/job/1', d)
    expect(seen[0]).toContain(tail) // the resolver has it...
    // ...but extractJobWithModel slices meta.mainText to 14_000 (model-extract.ts:9,61)
    expect(seen[0].length).toBeGreaterThan(14_000)
    expect(seen[0].slice(0, 14_000)).not.toContain(tail)
  })
})
