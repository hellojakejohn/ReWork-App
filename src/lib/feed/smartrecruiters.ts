// SmartRecruiters company job lists (public, no key) for matches on upload. Pulled daily with
// the other boards: every US posting of each company, as title + place only. The full text is
// fetched at match time like Workday's (the resolver reads jobs.smartrecruiters.com links).
// https://developers.smartrecruiters.com/docs/posting-api
import type { PrismaClient } from '@prisma/client'
import { syncBoard, toJobRow, type SyncResult } from './sync'
import type { FeedJob } from './boards'

type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any
type Db = Pick<PrismaClient, 'job'>

export interface SmartRecruitersBoard {
  /** The company id in jobs.smartrecruiters.com/{id}/... */
  id: string
  company: string
}

// Checked live Nov 14 (US postings). Non-tech heavy: fitness clubs, manufacturing, credit.
export const SMARTRECRUITERS_BOARDS: SmartRecruitersBoard[] = [
  { id: 'Equinox', company: 'Equinox' },
  { id: 'BoschGroup', company: 'Bosch' },
  { id: 'WesternDigital', company: 'Western Digital' },
  { id: 'Experian', company: 'Experian' },
]

const PAGE = 100
const MAX_PAGES = 20
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')

export const srBoardId = (b: SmartRecruitersBoard) => `smartrecruiters:${b.id}`

/** One page of postings as feed jobs (no text yet). US only, by the API's own filter. */
export function parseSmartRecruitersList(b: SmartRecruitersBoard, data: Json): (Omit<FeedJob, 'facts'> & { postedAt: Date | null })[] {
  const out: (Omit<FeedJob, 'facts'> & { postedAt: Date | null })[] = []
  for (const p of Array.isArray(data?.content) ? data.content : []) {
    const id = str(p?.id)
    const title = str(p?.name)
    if (!id || !title) continue
    const loc = p?.location ?? {}
    const place = [str(loc.city), str(loc.region)].filter(Boolean).join(', ') || str(loc.fullLocation)
    const remote = loc.remote === true
    const posted = str(p?.releasedDate)
    out.push({
      key: `smartrecruiters:${b.id}:${id}`,
      board: srBoardId(b),
      source: 'smartrecruiters',
      title,
      company: str(p?.company?.name) || b.company,
      location: remote && !/remote/i.test(place) ? (place ? `${place}, Remote` : 'Remote') : place,
      description: '',
      url: `https://jobs.smartrecruiters.com/${encodeURIComponent(b.id)}/${id}`,
      postedAt: posted && !Number.isNaN(new Date(posted).getTime()) ? new Date(posted) : null,
    })
  }
  return out
}

/** Every US posting of one company. Closes what's gone only when every page was read. */
export async function pullSmartRecruiters(db: Db, b: SmartRecruitersBoard, { fetchFn = fetch, now = new Date() }: { fetchFn?: typeof fetch; now?: Date } = {}): Promise<SyncResult> {
  const jobs: ReturnType<typeof parseSmartRecruitersList> = []
  let total = Infinity
  for (let page = 0; page < MAX_PAGES && page * PAGE < total; page++) {
    const res = await fetchFn(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(b.id)}/postings?country=us&limit=${PAGE}&offset=${page * PAGE}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    total = Number(data?.totalFound) || 0
    jobs.push(...parseSmartRecruitersList(b, data))
  }
  const complete = jobs.length > 0 && jobs.length >= Math.min(total, MAX_PAGES * PAGE)
  return syncBoard(db, srBoardId(b), jobs.map((j) => toJobRow(j, now)), { complete, now })
}

/** All SmartRecruiters companies, one at a time (a few pages each). Failures are listed, never thrown. */
export async function pullAllSmartRecruiters(db: Db, opts: { fetchFn?: typeof fetch; now?: Date; boards?: SmartRecruitersBoard[] } = {}) {
  const sum = { ok: 0, failed: [] as string[], listed: 0, added: 0, closed: 0 }
  for (const b of opts.boards ?? SMARTRECRUITERS_BOARDS) {
    try {
      const r = await pullSmartRecruiters(db, b, opts)
      sum.ok++
      sum.listed += r.listed
      sum.added += r.added
      sum.closed += r.closed
    } catch (e) {
      sum.failed.push(`${srBoardId(b)}: ${String((e as Error)?.message ?? e).slice(0, 120)}`)
    }
  }
  return sum
}
