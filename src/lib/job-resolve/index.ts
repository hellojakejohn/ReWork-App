// Job URL -> { title, company, location, description }. A chain of resolvers, first hit wins:
//   1. known ATS JSON APIs by URL pattern (Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Workable)
//   2. schema.org JobPosting JSON-LD in the page
//   3. OpenGraph/meta + readable main text, then the model extracts the fields
//   4. otherwise (JS-rendered page, Indeed/LinkedIn/Glassdoor, blocked): needsPaste
// Fetching and the model call are injected so the chain is testable offline.
import { matchAtsUrl, parseAtsResponse } from './ats'
import { extractJsonLdJob } from './json-ld'
import { extractPageMeta, type PageMeta } from './html-text'
import type { NeedsPasteReason, ResolveResult, ResolvedJob } from './types'

export type { ResolvedJob, ResolveResult } from './types'

export interface FetchedPage {
  status: number
  url: string
  text: string
}

export interface ResolveDeps {
  fetchPage: (url: string, accept: 'json' | 'html') => Promise<FetchedPage>
  extractWithModel?: (meta: PageMeta, url: string) => Promise<Omit<ResolvedJob, 'url' | 'source'> | null>
}

const BLOCKED_SITES: [RegExp, string][] = [
  [/(^|\.)indeed\.[a-z.]+$/, 'Indeed'],
  [/(^|\.)linkedin\.com$/, 'LinkedIn'],
  [/(^|\.)glassdoor\.[a-z.]+$/, 'Glassdoor'],
  [/(^|\.)ziprecruiter\.com$/, 'ZipRecruiter'],
  [/(^|\.)monster\.com$/, 'Monster'],
]
// Career sites that render the job client-side only, so a plain fetch gets an empty shell.
const JS_ONLY_SITES = [/(^|\.)(workforcenow|myjobs|recruiting)\.adp\.com$/]

// Below this much readable text a page is a JS shell, not a job posting.
const MIN_PAGE_TEXT = 300

export function needsPaste(reason: NeedsPasteReason, site?: string): ResolveResult {
  const messages: Record<NeedsPasteReason, string> = {
    blocked_site: `${site || 'That site'} doesn't let apps read its job pages. Paste the description instead.`,
    js_rendered: "That page loads the job with JavaScript, so we can't read it. Paste the description instead.",
    blocked: 'That site blocked us. Paste the description instead.',
    unreachable: "We couldn't open that page. Paste the description instead.",
    not_a_job: "That page doesn't look like a job posting. Paste the description instead.",
  }
  return { ok: false, needsPaste: true, reason, message: messages[reason] }
}

export function blockedSiteName(url: URL): string | null {
  const host = url.hostname.toLowerCase()
  return BLOCKED_SITES.find(([re]) => re.test(host))?.[1] ?? null
}

export function isJsOnlySite(url: URL): boolean {
  return JS_ONLY_SITES.some((re) => re.test(url.hostname.toLowerCase()))
}

export async function resolveJob(rawUrl: string, deps: ResolveDeps): Promise<ResolveResult> {
  const url = new URL(rawUrl)

  const blocked = blockedSiteName(url)
  if (blocked) return needsPaste('blocked_site', blocked)
  if (isJsOnlySite(url)) return needsPaste('js_rendered')

  // 1. ATS API
  const ats = matchAtsUrl(url)
  if (ats) {
    try {
      const res = await deps.fetchPage(ats.apiUrl, 'json')
      if (res.status >= 200 && res.status < 300) {
        const job = parseAtsResponse(ats, JSON.parse(res.text), url.href)
        if (job) return { ok: true, job }
      }
      console.warn(`[job-resolve] ${ats.ats} API gave no job (${res.status}), falling back to the page`)
    } catch (error) {
      console.warn(`[job-resolve] ${ats.ats} API failed, falling back to the page:`, (error as Error)?.message)
    }
  }

  // 2-3. The page itself
  let page: FetchedPage
  try {
    page = await deps.fetchPage(url.href, 'html')
  } catch (error) {
    console.warn('[job-resolve] page fetch failed:', (error as Error)?.message)
    return needsPaste('unreachable')
  }
  if (page.status === 401 || page.status === 403 || page.status === 429) return needsPaste('blocked')
  if (page.status < 200 || page.status >= 300) return needsPaste('unreachable')

  const fromJsonLd = extractJsonLdJob(page.text, url.href)
  if (fromJsonLd) return { ok: true, job: fromJsonLd }

  const meta = extractPageMeta(page.text)
  if (meta.mainText.length < MIN_PAGE_TEXT) return needsPaste('js_rendered')

  if (deps.extractWithModel) {
    try {
      const extracted = await deps.extractWithModel(meta, url.href)
      if (!extracted) return needsPaste('not_a_job')
      return { ok: true, job: { ...extracted, url: url.href, source: 'page' } }
    } catch (error) {
      console.error('[job-resolve] model extraction failed, using page text as-is:', (error as Error)?.message)
    }
  }

  // No model available: hand back what the page says and let the user edit it.
  return {
    ok: true,
    job: {
      title: meta.ogTitle || meta.title,
      company: meta.siteName,
      location: '',
      description: meta.mainText,
      url: url.href,
      source: 'page',
    },
  }
}
