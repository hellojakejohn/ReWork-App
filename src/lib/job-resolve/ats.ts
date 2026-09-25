// Known applicant-tracking systems with public JSON APIs. Pure: URL matching and response
// parsing only; fetching happens in ./index.ts.
import { cleanLines, decodeEntities, htmlToText } from './html-text'
import type { JobSource, ResolvedJob } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any

export interface AtsMatch {
  ats: Exclude<JobSource, 'json-ld' | 'page'>
  apiUrl: string
  company: string // slug-derived fallback when the API doesn't name the company
  jobId: string
}

export function companyFromSlug(slug: string): string {
  return decodeURIComponent(slug)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const seg = (url: URL) => url.pathname.split('/').filter(Boolean)

export function matchAtsUrl(input: string | URL): AtsMatch | null {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()
  const parts = seg(url)

  // Greenhouse: boards.greenhouse.io/{board}/jobs/{id}, job-boards(.eu).greenhouse.io/...,
  // boards.greenhouse.io/embed/job_app?for={board}&token={id}
  if (/(^|\.)greenhouse\.io$/.test(host)) {
    let board = ''
    let id = ''
    if (parts[0] === 'embed') {
      board = url.searchParams.get('for') || ''
      id = url.searchParams.get('token') || ''
    } else if (parts[1] === 'jobs' && /^\d+$/.test(parts[2] || '')) {
      board = parts[0]
      id = parts[2]
    }
    if (board && /^\d+$/.test(id)) {
      return {
        ats: 'greenhouse',
        apiUrl: `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${id}`,
        company: companyFromSlug(board),
        jobId: id,
      }
    }
    return null
  }

  // Lever: jobs.lever.co/{company}/{uuid}[/apply], jobs.eu.lever.co/...
  if (host === 'jobs.lever.co' || host === 'jobs.eu.lever.co') {
    const [company, id] = parts
    if (company && /^[0-9a-f-]{36}$/i.test(id || '')) {
      const api = host === 'jobs.eu.lever.co' ? 'api.eu.lever.co' : 'api.lever.co'
      return { ats: 'lever', apiUrl: `https://${api}/v0/postings/${encodeURIComponent(company)}/${id}`, company: companyFromSlug(company), jobId: id }
    }
    return null
  }

  // Ashby: jobs.ashbyhq.com/{org}/{uuid}[/application]
  if (host === 'jobs.ashbyhq.com') {
    const [org, id] = parts
    if (org && /^[0-9a-f-]{36}$/i.test(id || '')) {
      return {
        ats: 'ashby',
        apiUrl: `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(org)}?includeCompensation=true`,
        company: companyFromSlug(org),
        jobId: id,
      }
    }
    return null
  }

  // Workday: {tenant}.wd{N}.myworkdayjobs.com/[{locale}/]{site}/job/{...}
  const workday = host.match(/^([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com$/)
  if (workday) {
    const tenant = workday[1]
    const rest = /^[a-z]{2}-[A-Z]{2}$/.test(parts[0] || '') ? parts.slice(1) : parts
    const [site, marker, ...jobPath] = rest
    if (site && marker === 'job' && jobPath.length > 0) {
      const last = jobPath[jobPath.length - 1]
      return {
        ats: 'workday',
        apiUrl: `https://${host}/wday/cxs/${tenant}/${site}/job/${jobPath.join('/')}`,
        company: companyFromSlug(tenant),
        jobId: last.split('_').pop() || last,
      }
    }
    return null
  }

  // SmartRecruiters: jobs.smartrecruiters.com/{company}/{id}[-slug]
  if (host === 'jobs.smartrecruiters.com' || host === 'careers.smartrecruiters.com') {
    const [company, posting] = parts
    const id = (posting || '').match(/^(\d{6,})/)?.[1]
    if (company && id) {
      return {
        ats: 'smartrecruiters',
        apiUrl: `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings/${id}`,
        company: companyFromSlug(company),
        jobId: id,
      }
    }
    return null
  }

  // Workable: apply.workable.com/{account}/j/{shortcode}, {account}.workable.com/j/{shortcode}
  if (host === 'apply.workable.com' || /^[a-z0-9-]+\.workable\.com$/.test(host)) {
    const account = host === 'apply.workable.com' ? parts[0] : host.split('.')[0]
    const rest = host === 'apply.workable.com' ? parts.slice(1) : parts
    if (account && account !== 'www' && rest[0] === 'j' && /^[A-Z0-9]{6,}$/i.test(rest[1] || '')) {
      return {
        ats: 'workable',
        apiUrl: `https://apply.workable.com/api/v2/accounts/${encodeURIComponent(account)}/jobs/${rest[1]}`,
        company: companyFromSlug(account),
        jobId: rest[1],
      }
    }
    return null
  }

  return null
}

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const joinLoc = (...parts: unknown[]) => [...new Set(parts.map(s).filter(Boolean))].join(', ')

function section(title: string, html: string): string {
  const body = htmlToText(html, { strip: false })
  return body ? (title ? `${title}\n${body}` : body) : ''
}

/** Parse an ATS API response into a job. Returns null when the payload isn't usable. */
export function parseAtsResponse(match: AtsMatch, data: Json, pageUrl: string): ResolvedJob | null {
  const job = (partial: Omit<ResolvedJob, 'url' | 'source'>): ResolvedJob | null =>
    partial.title && partial.description.length > 50 ? { ...partial, description: cleanLines(partial.description), url: pageUrl, source: match.ats } : null

  switch (match.ats) {
    case 'greenhouse':
      return job({
        title: s(data?.title),
        company: s(data?.company_name) || match.company,
        location: s(data?.location?.name),
        description: htmlToText(decodeEntities(s(data?.content)), { strip: false }),
      })

    case 'lever': {
      const lists = Array.isArray(data?.lists) ? data.lists : []
      const html = [s(data?.description), ...lists.map((l: Json) => `<h3>${s(l?.text)}</h3><ul>${s(l?.content)}</ul>`), s(data?.additional)].join('\n')
      const workplace = s(data?.workplaceType)
      const location = s(data?.categories?.location)
      return job({
        title: s(data?.text),
        company: match.company,
        location: workplace === 'remote' && !/remote/i.test(location) ? joinLoc(location, 'Remote') : location,
        description: htmlToText(html, { strip: false }) || s(data?.descriptionPlain),
      })
    }

    case 'ashby': {
      const posting = (Array.isArray(data?.jobs) ? data.jobs : []).find((j: Json) => s(j?.id).toLowerCase() === match.jobId.toLowerCase())
      if (!posting) return null
      return job({
        title: s(posting.title),
        company: s(data?.organizationName) || match.company,
        location: posting.isRemote && !/remote/i.test(s(posting.location)) ? joinLoc(posting.location, 'Remote') : s(posting.location),
        description: posting.descriptionHtml ? htmlToText(s(posting.descriptionHtml), { strip: false }) : s(posting.descriptionPlain),
      })
    }

    case 'workday': {
      const info = data?.jobPostingInfo
      return job({
        title: s(info?.title),
        company: s(data?.hiringOrganization?.name) || match.company,
        location: s(info?.location),
        description: htmlToText(s(info?.jobDescription), { strip: false }),
      })
    }

    case 'smartrecruiters': {
      const sections = data?.jobAd?.sections ?? {}
      const description = ['jobDescription', 'qualifications', 'additionalInformation']
        .map((key) => section(s(sections[key]?.title), s(sections[key]?.text)))
        .filter(Boolean)
        .join('\n\n')
      const loc = data?.location ?? {}
      return job({
        title: s(data?.name),
        company: s(data?.company?.name) || match.company,
        location: s(loc.fullLocation) || joinLoc(loc.city, loc.region, loc.country, loc.remote ? 'Remote' : ''),
        description,
      })
    }

    case 'workable': {
      const description = [
        section('', s(data?.description ?? data?.descriptionHtml)),
        section('Requirements', s(data?.requirements ?? data?.requirementsHtml)),
        section('Benefits', s(data?.benefits ?? data?.benefitsHtml)),
      ]
        .filter(Boolean)
        .join('\n\n')
      const loc = data?.location ?? {}
      return job({
        title: s(data?.title),
        company: match.company,
        location: joinLoc(loc.city, loc.region, loc.country, data?.remote ? 'Remote' : ''),
        description,
      })
    }
  }
}
