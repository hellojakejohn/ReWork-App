// Job feed spike: list every open job on a company's public ATS board. Reuses the resolver's
// per-job parser (src/lib/job-resolve/ats.ts), so a feed job reads exactly like a pasted URL.
// Pure: fetching is left to the caller.
import { parseAtsResponse, companyFromSlug } from '@/lib/job-resolve/ats'
import type { ResolvedJob } from '@/lib/job-resolve/types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any

export type BoardAts = 'greenhouse' | 'lever' | 'ashby'

export interface Board {
  ats: BoardAts
  slug: string
}

export interface FeedJob extends ResolvedJob {
  /** Stable id: ats:slug:jobId. */
  key: string
  /** boardId(): ats:slug. */
  board: string
}

export const boardId = (b: { ats: string; slug?: string; tenant?: string }) => `${b.ats}:${b.slug ?? b.tenant}`

export function boardListUrl({ ats, slug }: Board): string {
  const s = encodeURIComponent(slug)
  if (ats === 'greenhouse') return `https://boards-api.greenhouse.io/v1/boards/${s}/jobs?content=true&pay_transparency=true`
  if (ats === 'lever') return `https://api.lever.co/v0/postings/${s}?mode=json`
  return `https://api.ashbyhq.com/posting-api/job-board/${s}?includeCompensation=true`
}

const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')

/** Every job in one board's list response, parsed like a single resolved job. */
export function parseBoardList(board: Board, data: Json): FeedJob[] {
  const company = companyFromSlug(board.slug)
  const items: { id: string; url: string; item: Json }[] =
    board.ats === 'greenhouse'
      ? (Array.isArray(data?.jobs) ? data.jobs : []).map((j: Json) => ({ id: str(j?.id), url: str(j?.absolute_url), item: j }))
      : board.ats === 'lever'
        ? (Array.isArray(data) ? data : []).map((j: Json) => ({ id: str(j?.id), url: str(j?.hostedUrl), item: j }))
        : (Array.isArray(data?.jobs) ? data.jobs : [])
            .filter((j: Json) => j?.isListed !== false)
            // The Ashby parser looks its job up by id inside the whole board response.
            .map((j: Json) => ({ id: str(j?.id), url: str(j?.jobUrl), item: data }))

  const out: FeedJob[] = []
  for (const { id, url, item } of items) {
    if (!id) continue
    const job = parseAtsResponse({ ats: board.ats, apiUrl: '', company, jobId: id }, item, url)
    if (job) out.push({ ...job, key: `${board.ats}:${board.slug}:${id}`, board: boardId(board) })
  }
  return out
}

/** Same company, title and location = the same job listed twice (multi-location reposts). */
export function dedupeJobs<T extends { company: string; title: string; location: string }>(jobs: T[]): T[] {
  const seen = new Set<string>()
  return jobs.filter((j) => {
    const k = [j.company, j.title, j.location].map((v) => v.toLowerCase().replace(/\s+/g, ' ').trim()).join('|')
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** One role listed per city ("Restaurant General Manager" x 10) collapses to one feed row. */
export function roleKey(job: { company: string; title: string }): string {
  const title = job.title
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s[-–|]\s[^-–|]*\b(remote|[a-z]+,\s*[a-z]{2})\b.*$/i, ' ')
    .replace(/[^a-z0-9+#]+/g, ' ')
    .trim()
  return `${job.company.toLowerCase()}|${title}`
}

// ---------- Workday: searched by title, not pulled whole ----------

export interface WorkdayBoard {
  company: string
  tenant: string
  /** e.g. target.wd5.myworkdayjobs.com */
  host: string
  site: string
}

/** Workday's own career-site search: 20 jobs per call, newest and best first. */
export function workdaySearchRequest(b: WorkdayBoard, searchText: string, offset = 0): { url: string; body: string } {
  return {
    url: `https://${b.host}/wday/cxs/${b.tenant}/${b.site}/jobs`,
    body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText }),
  }
}

/** "Posted Today", "Posted Yesterday", "Posted 3 Days Ago", "Posted 30+ Days Ago". */
export function workdayPostedAt(postedOn: string, now = new Date()): Date | null {
  const t = postedOn.toLowerCase()
  const day = 24 * 60 * 60 * 1000
  if (/today/.test(t)) return now
  if (/yesterday/.test(t)) return new Date(now.getTime() - day)
  const n = t.match(/(\d+)\+?\s*days?/)
  return n ? new Date(now.getTime() - Number(n[1]) * day) : null
}

/**
 * Search results, without the description (the list doesn't carry it). The job's own page is
 * fetched later, only for jobs that pass someone's prefilter, through the resolver.
 */
export function parseWorkdaySearch(b: WorkdayBoard, data: Json, now = new Date()): (Omit<FeedJob, 'facts'> & { postedAt: Date | null })[] {
  const company = b.company || companyFromSlug(b.tenant)
  const out: (Omit<FeedJob, 'facts'> & { postedAt: Date | null })[] = []
  for (const p of Array.isArray(data?.jobPostings) ? data.jobPostings : []) {
    const path = str(p?.externalPath)
    const title = str(p?.title).trim()
    if (!path.startsWith('/job/') || !title) continue
    const id = (Array.isArray(p?.bulletFields) && str(p.bulletFields[0])) || path.split('_').pop() || path
    out.push({
      key: `workday:${b.tenant}:${id}`,
      board: boardId({ ats: 'workday', tenant: b.tenant }),
      source: 'workday',
      title,
      company,
      location: str(p?.locationsText),
      description: '',
      url: `https://${b.host}/${b.site}${path}`,
      postedAt: workdayPostedAt(str(p?.postedOn), now),
    })
  }
  return out
}
