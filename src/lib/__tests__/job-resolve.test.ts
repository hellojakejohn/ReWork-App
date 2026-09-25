import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { matchAtsUrl, parseAtsResponse } from '@/lib/job-resolve/ats'
import { extractJsonLdJob } from '@/lib/job-resolve/json-ld'
import { extractPageMeta, htmlToText } from '@/lib/job-resolve/html-text'
import { resolveJob, type FetchedPage } from '@/lib/job-resolve'

const fixture = (name: string) => readFileSync(path.join(__dirname, 'fixtures/jobs', name), 'utf8')

describe('matchAtsUrl', () => {
  it.each([
    [
      'https://boards.greenhouse.io/stripe/jobs/6012345',
      'greenhouse',
      'https://boards-api.greenhouse.io/v1/boards/stripe/jobs/6012345',
      'Stripe',
    ],
    [
      'https://job-boards.greenhouse.io/anthropic/jobs/4020305008?gh_src=x',
      'greenhouse',
      'https://boards-api.greenhouse.io/v1/boards/anthropic/jobs/4020305008',
      'Anthropic',
    ],
    [
      'https://boards.greenhouse.io/embed/job_app?for=figma&token=5098123',
      'greenhouse',
      'https://boards-api.greenhouse.io/v1/boards/figma/jobs/5098123',
      'Figma',
    ],
    [
      'https://jobs.lever.co/palantir/0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d/apply',
      'lever',
      'https://api.lever.co/v0/postings/palantir/0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
      'Palantir',
    ],
    [
      'https://jobs.eu.lever.co/some-co/0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
      'lever',
      'https://api.eu.lever.co/v0/postings/some-co/0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
      'Some Co',
    ],
    [
      'https://jobs.ashbyhq.com/ramp/34413f8d-26bf-4bbc-8ade-eb309a0e2245/application',
      'ashby',
      'https://api.ashbyhq.com/posting-api/job-board/ramp?includeCompensation=true',
      'Ramp',
    ],
    [
      'https://target.wd5.myworkdayjobs.com/en-US/targetcareers/job/Minneapolis-MN/Software-Engineer_R0012345',
      'workday',
      'https://target.wd5.myworkdayjobs.com/wday/cxs/target/targetcareers/job/Minneapolis-MN/Software-Engineer_R0012345',
      'Target',
    ],
    [
      'https://acme.wd1.myworkdayjobs.com/External/job/Remote/Analyst_JR-99',
      'workday',
      'https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/External/job/Remote/Analyst_JR-99',
      'Acme',
    ],
    [
      'https://jobs.smartrecruiters.com/BoschGroup/744000012345678-software-engineer',
      'smartrecruiters',
      'https://api.smartrecruiters.com/v1/companies/BoschGroup/postings/744000012345678',
      'BoschGroup',
    ],
    [
      'https://apply.workable.com/northwind/j/A1B2C3D4E5/',
      'workable',
      'https://apply.workable.com/api/v2/accounts/northwind/jobs/A1B2C3D4E5',
      'Northwind',
    ],
    [
      'https://northwind.workable.com/j/A1B2C3D4E5',
      'workable',
      'https://apply.workable.com/api/v2/accounts/northwind/jobs/A1B2C3D4E5',
      'Northwind',
    ],
  ])('%s -> %s', (url, ats, apiUrl, company) => {
    expect(matchAtsUrl(url)).toMatchObject({ ats, apiUrl, company })
  })

  it.each([
    'https://boards.greenhouse.io/stripe', // board index, not a job
    'https://jobs.lever.co/palantir',
    'https://target.wd5.myworkdayjobs.com/en-US/targetcareers',
    'https://careers.example.com/jobs/123',
    'https://www.workable.com/j/ABCDEF123',
    'not a url',
  ])('no match for %s', (url) => {
    expect(matchAtsUrl(url)).toBeNull()
  })
})

describe('parseAtsResponse', () => {
  it('reads a Greenhouse job (entity-encoded content)', () => {
    const match = matchAtsUrl('https://boards.greenhouse.io/northwind/jobs/123')!
    const job = parseAtsResponse(
      match,
      {
        title: 'Backend Engineer',
        location: { name: 'Remote - US' },
        company_name: 'Northwind Logistics',
        content: '&lt;p&gt;Join Our Team building freight software.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Node.js services&lt;/li&gt;&lt;li&gt;PostgreSQL&lt;/li&gt;&lt;/ul&gt;',
      },
      'https://boards.greenhouse.io/northwind/jobs/123'
    )
    expect(job).toEqual({
      title: 'Backend Engineer',
      company: 'Northwind Logistics',
      location: 'Remote - US',
      description: 'Join Our Team building freight software.\n• Node.js services\n• PostgreSQL',
      url: 'https://boards.greenhouse.io/northwind/jobs/123',
      source: 'greenhouse',
    })
  })

  it('reads a Lever posting with lists', () => {
    const match = matchAtsUrl('https://jobs.lever.co/acme-labs/0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d')!
    const job = parseAtsResponse(
      match,
      {
        text: 'Data Analyst',
        categories: { location: 'Saint Paul, MN', team: 'Ops' },
        workplaceType: 'hybrid',
        description: '<div>Help us understand our customers and grow the business.</div>',
        lists: [{ text: 'Requirements', content: '<li>SQL</li><li>Looker</li>' }],
        additional: '<div>We offer great benefits.</div>',
      },
      'https://jobs.lever.co/acme-labs/x'
    )
    expect(job?.company).toBe('Acme Labs')
    expect(job?.location).toBe('Saint Paul, MN')
    expect(job?.description).toBe(
      'Help us understand our customers and grow the business.\nRequirements\n• SQL\n• Looker\nWe offer great benefits.'
    )
  })

  it('finds the right Ashby job in the board response', () => {
    const match = matchAtsUrl('https://jobs.ashbyhq.com/ramp/34413f8d-26bf-4bbc-8ade-eb309a0e2245')!
    const job = parseAtsResponse(
      match,
      {
        jobs: [
          { id: 'other', title: 'Nope', descriptionHtml: '<p>x</p>' },
          {
            id: '34413f8d-26bf-4bbc-8ade-eb309a0e2245',
            title: 'Software Engineer, Payments',
            location: 'New York',
            isRemote: true,
            descriptionHtml: '<h1>About Ramp</h1><p>Ramp builds finance automation for thousands of businesses.</p>',
          },
        ],
      },
      match.apiUrl
    )
    expect(job).toMatchObject({ title: 'Software Engineer, Payments', company: 'Ramp', location: 'New York, Remote' })
    expect(job?.description).toBe('About Ramp\nRamp builds finance automation for thousands of businesses.')
  })

  it('reads Workday, SmartRecruiters and Workable payloads', () => {
    const wd = matchAtsUrl('https://target.wd5.myworkdayjobs.com/en-US/targetcareers/job/Minneapolis-MN/Engineer_R1')!
    expect(
      parseAtsResponse(
        wd,
        {
          jobPostingInfo: { title: 'Engineer', location: 'Minneapolis, MN', jobDescription: '<p>Build retail systems used in every store we run, from checkout to supply chain.</p>' },
          hiringOrganization: { name: 'Target Corporation' },
        },
        'u'
      )
    ).toMatchObject({ title: 'Engineer', company: 'Target Corporation', location: 'Minneapolis, MN', source: 'workday' })

    const sr = matchAtsUrl('https://jobs.smartrecruiters.com/BoschGroup/744000012345678-engineer')!
    const srJob = parseAtsResponse(
      sr,
      {
        name: 'Embedded Engineer',
        company: { name: 'Bosch Group' },
        location: { city: 'Plymouth', region: 'MN', country: 'us' },
        jobAd: {
          sections: {
            jobDescription: { title: 'Job Description', text: '<p>Write firmware for sensors in cars.</p>' },
            qualifications: { title: 'Qualifications', text: '<ul><li>C++</li></ul>' },
          },
        },
      },
      'u'
    )
    expect(srJob?.location).toBe('Plymouth, MN, us')
    expect(srJob?.description).toBe('Job Description\nWrite firmware for sensors in cars.\n\nQualifications\n• C++')

    const wk = matchAtsUrl('https://apply.workable.com/northwind/j/A1B2C3D4E5')!
    expect(
      parseAtsResponse(
        wk,
        {
          title: 'Support Lead',
          location: { city: 'Duluth', region: 'Minnesota', country: 'United States' },
          remote: false,
          description: '<p>Lead our support team of friendly humans.</p>',
          requirements: '<ul><li>Zendesk</li></ul>',
        },
        'u'
      )
    ).toMatchObject({ location: 'Duluth, Minnesota, United States', description: 'Lead our support team of friendly humans.\n\nRequirements\n• Zendesk' })
  })

  it('returns null for an empty payload', () => {
    const match = matchAtsUrl('https://boards.greenhouse.io/x/jobs/1')!
    expect(parseAtsResponse(match, { status: 404 }, 'u')).toBeNull()
  })
})

describe('JSON-LD extraction', () => {
  it('reads a JobPosting with escaped HTML, keeps bullets and the first character, drops EEO text', () => {
    const job = extractJsonLdJob(fixture('jsonld-careers.html'), 'https://careers.northwind.example/jobs/42')!
    expect(job).toMatchObject({
      title: 'Senior Backend Engineer',
      company: 'Northwind Logistics',
      location: 'Minneapolis, MN, US; Chicago, IL, US',
      source: 'json-ld',
    })
    expect(job.description.startsWith('Join Our Team')).toBe(true)
    expect(job.description).toContain("What you'll do\n• Design and run Node.js and PostgreSQL services\n• Own CI/CD for the pricing platform")
    expect(job.description).toContain('Pay range: $150,000 - $180,000')
    expect(job.description).not.toMatch(/equal opportunity/i)
  })

  it('finds a JobPosting inside @graph with an array @type and remote location', () => {
    const job = extractJsonLdJob(fixture('jsonld-graph.html'), 'https://acme.example/careers/designer')!
    expect(job).toMatchObject({ title: 'Product Designer', company: 'Acme Studio', location: 'Remote' })
    expect(job.description).toBe('Design the product end to end.\n• Figma\n• User research\nWe work async across time zones and ship weekly.')
  })

  it('returns null when there is no JobPosting', () => {
    expect(extractJsonLdJob(fixture('plain-page.html'), 'u')).toBeNull()
  })
})

describe('page text', () => {
  it('keeps the job content and strips nav, cookie banners and footer', () => {
    const meta = extractPageMeta(fixture('plain-page.html'))
    expect(meta.ogTitle).toBe('Operations Coordinator')
    expect(meta.siteName).toBe('Riverbend Foods')
    expect(meta.mainText.startsWith('Join Our Team at Riverbend Foods')).toBe(true)
    expect(meta.mainText).toContain('Responsibilities\n• Schedule production runs and coordinate with the warehouse')
    expect(meta.mainText).not.toMatch(/Apply now|Privacy Policy|cookies|Home/)
  })

  it('does not drop leading characters', () => {
    expect(htmlToText('<div><p>Join Our Team</p></div>')).toBe('Join Our Team')
  })
})

describe('resolveJob chain', () => {
  const pages = (map: Record<string, FetchedPage | Error>) =>
    vi.fn(async (url: string) => {
      const hit = map[url]
      if (!hit) throw new Error(`unexpected fetch ${url}`)
      if (hit instanceof Error) throw hit
      return hit
    })

  it('uses the ATS API first', async () => {
    const fetchPage = pages({
      'https://boards-api.greenhouse.io/v1/boards/acme/jobs/1': {
        status: 200,
        url: '',
        text: JSON.stringify({ title: 'Engineer', location: { name: 'Remote' }, content: '<p>Build things that matter for our customers every day.</p>' }),
      },
    })
    const result = await resolveJob('https://boards.greenhouse.io/acme/jobs/1', { fetchPage })
    expect(result).toMatchObject({ ok: true, job: { source: 'greenhouse', company: 'Acme' } })
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('falls back to the page when the ATS API fails', async () => {
    const url = 'https://boards.greenhouse.io/northwind/jobs/2'
    const fetchPage = pages({
      'https://boards-api.greenhouse.io/v1/boards/northwind/jobs/2': { status: 404, url: '', text: '{}' },
      [url]: { status: 200, url, text: fixture('jsonld-careers.html') },
    })
    const result = await resolveJob(url, { fetchPage })
    expect(result).toMatchObject({ ok: true, job: { source: 'json-ld', title: 'Senior Backend Engineer' } })
  })

  it('returns needsPaste for Indeed/LinkedIn/Glassdoor without fetching', async () => {
    const fetchPage = pages({})
    for (const url of ['https://www.indeed.com/viewjob?jk=abc', 'https://www.linkedin.com/jobs/view/123', 'https://www.glassdoor.com/job-listing/x']) {
      const result = await resolveJob(url, { fetchPage })
      expect(result).toMatchObject({ ok: false, needsPaste: true, reason: 'blocked_site' })
    }
    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('returns needsPaste for ADP Workforce Now without fetching', async () => {
    const fetchPage = pages({})
    const result = await resolveJob(
      'https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=abc&jobId=123',
      { fetchPage }
    )
    expect(result).toMatchObject({ ok: false, needsPaste: true, reason: 'js_rendered' })
  })

  it('returns needsPaste for an empty JS shell on an unknown site', async () => {
    const url = 'https://jobs.example-shell.com/job/1'
    const result = await resolveJob(url, { fetchPage: pages({ [url]: { status: 200, url, text: fixture('adp-shell.html') } }) })
    expect(result).toMatchObject({ ok: false, needsPaste: true, reason: 'js_rendered' })
  })

  it('returns needsPaste when the site blocks us', async () => {
    const url = 'https://careers.example.com/job/9'
    const result = await resolveJob(url, { fetchPage: pages({ [url]: { status: 403, url, text: '' } }) })
    expect(result).toMatchObject({ ok: false, reason: 'blocked' })
  })

  it('asks the model for pages without JSON-LD', async () => {
    const url = 'https://riverbend.example/careers/ops'
    const extractWithModel = vi.fn(async () => ({ title: 'Operations Coordinator', company: 'Riverbend Foods', location: 'Saint Paul, MN', description: 'x'.repeat(80) }))
    const result = await resolveJob(url, { fetchPage: pages({ [url]: { status: 200, url, text: fixture('plain-page.html') } }), extractWithModel })
    expect(result).toMatchObject({ ok: true, job: { source: 'page', company: 'Riverbend Foods' } })
    expect((extractWithModel.mock.calls[0] as unknown as [{ mainText: string }])[0].mainText).toContain('Track inventory in NetSuite')
  })

  it('falls back to page text when the model call fails', async () => {
    const url = 'https://riverbend.example/careers/ops'
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await resolveJob(url, {
      fetchPage: pages({ [url]: { status: 200, url, text: fixture('plain-page.html') } }),
      extractWithModel: async () => {
        throw new Error('insufficient_quota')
      },
    })
    spy.mockRestore()
    expect(result).toMatchObject({ ok: true, job: { title: 'Operations Coordinator', company: 'Riverbend Foods', source: 'page' } })
  })
})
