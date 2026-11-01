import { describe, expect, it } from 'vitest'
import { cleanJobUrl } from '@/lib/job-url'
import { readPastedJob } from '@/lib/job-checks'

// The Trane link from Indeed, Nov 1: ~700 characters of tracking.
const TRANE =
  'https://careers.tranetechnologies.com/global/en/job/92600058/Sr-Applications-Developer-Full-Stack?utm_source=srm029&utm_campaign=Digital&utm_medium=cpc?source=srm029&utm_source=srm029&utm_medium=cpc&utm_campaign=Digital&rb=indeed-digital-and-technology-trane-technologies-prog-pc-d-n-n-n&jdx_cjid=a67627a9-01e4-4cc0-97b2-e5acb992de7d&jdx_click=5be2ff5b-f0d4-4bf5-b5ee-ab71f19cbcee&jdx_source=indeed&jdx_cwjid=a67627a9-01e4-4cc0-97b2-e5acb992de7d---indeed&jdx_jid=92600058&jdx_jsid=medium-digital-and-technology-trane-technologies-prog-pc-d-n-n-n&jdx_jswid=medium-digital-and-technology-trane-technologies-prog-pc-d-n-n-n-indeed&jdx_bid=0.0&jdx_bt=full_bid_opt&jdx=1'

describe('cleanJobUrl', () => {
  it('strips tracking, including a stray second "?"', () => {
    expect(cleanJobUrl(TRANE)).toBe('https://careers.tranetechnologies.com/global/en/job/92600058/Sr-Applications-Developer-Full-Stack')
  })
  it('keeps the parameters that find the job', () => {
    expect(cleanJobUrl('https://boards.greenhouse.io/acme/jobs/1?gh_jid=123&utm_source=x')).toBe('https://boards.greenhouse.io/acme/jobs/1?gh_jid=123')
    expect(cleanJobUrl('https://www.indeed.com/viewjob?jk=abc123&from=serp&vjs=3')).toBe('https://www.indeed.com/viewjob?jk=abc123&vjs=3')
    expect(cleanJobUrl('https://www.linkedin.com/jobs/view/42/?trk=public&refId=x')).toBe('https://www.linkedin.com/jobs/view/42/')
  })
  it('leaves non-links alone', () => {
    expect(cleanJobUrl(' not a link ')).toBe('not a link')
  })
})

describe('readPastedJob with long links', () => {
  it('reads a long tracking link alone as a link, cleaned', () => {
    expect(readPastedJob(TRANE)).toEqual({ kind: 'link', url: 'https://careers.tranetechnologies.com/global/en/job/92600058/Sr-Applications-Developer-Full-Stack' })
    expect(readPastedJob(`Check this one out ${TRANE}`).kind).toBe('link')
  })
  it('still reads a whole post that mentions a link as a post', () => {
    const post = `Senior Engineer\nAbout Acme\nAt Acme, we build tools. ${'We ship software every week and care about quality. '.repeat(5)}\nApply: ${TRANE}`
    expect(readPastedJob(post).kind).toBe('post')
  })
})
