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
  board: string
}

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
    if (job) out.push({ ...job, key: `${board.ats}:${board.slug}:${id}`, board: board.slug })
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
