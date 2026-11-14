// USAJOBS (federal jobs: VA hospitals, logistics, admin, accounting, IT...) for matches on
// upload. Searched at match time, like Workday, with the person's target title, in their
// state and remote. Free public data, but it needs a key: off unless USAJOBS_API_KEY and
// USAJOBS_EMAIL (the email the key was issued to; USAJOBS asks for it as the User-Agent) are
// set. The search answer already carries the duties and qualifications, so no second fetch.
// https://developer.usajobs.gov/tutorials/search-jobs
import type { PrismaClient } from '@prisma/client'
import { syncBoard, toJobRow } from './sync'
import { stateName } from './prefilter'
import type { FeedJob } from './boards'

type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any
type Db = Pick<PrismaClient, 'job'>

export const USAJOBS_BOARD = 'usajobs:search'
const API = 'https://data.usajobs.gov/api/search'

export function usajobsConfigured(env: NodeJS.ProcessEnv = process.env): { key: string; email: string } | null {
  const key = env.USAJOBS_API_KEY?.trim()
  const email = env.USAJOBS_EMAIL?.trim()
  return key && email ? { key, email } : null
}

/** One search per title: in their state unless remote-only, and remote unless near-only. */
export function usajobsQueries(titles: string[], workplace: 'remote' | 'near' | 'both', homeState: string | null): string[] {
  const state = homeState ? stateName(homeState) : null
  const out: string[] = []
  for (const t of titles) {
    const p = new URLSearchParams({ Keyword: t, ResultsPerPage: '50', SortField: 'opendate', SortDirection: 'desc' })
    if (workplace !== 'remote' && state) out.push(`${API}?${new URLSearchParams({ ...Object.fromEntries(p), LocationName: state })}`)
    if (workplace !== 'near' || !state) out.push(`${API}?${new URLSearchParams({ ...Object.fromEntries(p), RemoteIndicator: 'True' })}`)
  }
  return out
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : str(v) ? [str(v)] : [])

const PERIOD: Record<string, string> = { PA: 'a year', PH: 'an hour', PM: 'a month', PW: 'a week', BW: 'every two weeks' }

/** "$64,500 to $83,850 a year" from the posting's pay range (shown as written by USAJOBS). */
function payLine(rem: Json): string {
  const r = Array.isArray(rem) ? rem[0] : null
  const min = Number(r?.MinimumRange)
  const max = Number(r?.MaximumRange)
  if (!(min > 0)) return ''
  const fmt = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  const range = max > min ? `${fmt(min)} to ${fmt(max)}` : fmt(min)
  return `Pay: ${range} ${PERIOD[str(r?.RateIntervalCode)] ?? ''}`.trim()
}

/** The search answer as feed jobs. Closed ones (close date passed) are left out. */
export function parseUsajobs(data: Json, now = new Date()): (Omit<FeedJob, 'facts'> & { postedAt: Date | null; facts: FeedJob['facts'] })[] {
  const items: Json[] = Array.isArray(data?.SearchResult?.SearchResultItems) ? data.SearchResult.SearchResultItems : []
  const out: (Omit<FeedJob, 'facts'> & { postedAt: Date | null; facts: FeedJob['facts'] })[] = []
  for (const item of items) {
    const d = item?.MatchedObjectDescriptor
    const id = str(item?.MatchedObjectId) || str(d?.PositionID)
    const title = str(d?.PositionTitle)
    const url = str(d?.PositionURI)
    if (!id || !title || !url) continue
    const closes = str(d?.ApplicationCloseDate)
    if (closes && new Date(closes).getTime() < now.getTime()) continue
    const details = d?.UserArea?.Details ?? {}
    const remote = /^true$/i.test(str(details?.RemoteIndicator)) || details?.RemoteIndicator === true
    const place = str(d?.PositionLocationDisplay)
    const description = [
      payLine(d?.PositionRemuneration),
      str(details?.JobSummary),
      list(details?.MajorDuties).length ? `Duties:\n${list(details.MajorDuties).map((x) => `- ${x}`).join('\n')}` : '',
      str(d?.QualificationSummary) ? `Qualifications:\n${str(d.QualificationSummary)}` : '',
      list(details?.Education).length ? `Education:\n${list(details.Education).join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
    const posted = str(d?.PublicationStartDate)
    out.push({
      key: `usajobs:${id}`,
      board: USAJOBS_BOARD,
      source: 'usajobs',
      title,
      company: str(d?.OrganizationName) || str(d?.DepartmentName) || 'U.S. Government',
      location: remote && !/remote/i.test(place) ? `${place}, Remote` : place,
      description,
      url,
      postedAt: posted && !Number.isNaN(new Date(posted).getTime()) ? new Date(posted) : null,
      facts: { posted: posted.slice(0, 10) || undefined, closes: closes.slice(0, 10) || undefined, pay: !!payLine(d?.PositionRemuneration) },
    })
  }
  return out
}

/** Run the searches and keep what comes back. Returns how many different jobs. */
export async function searchUsajobs(
  db: Db,
  urls: string[],
  { fetchFn = fetch, now = new Date(), auth = usajobsConfigured() }: { fetchFn?: typeof fetch; now?: Date; auth?: { key: string; email: string } | null } = {}
): Promise<number> {
  if (!auth || urls.length === 0) return 0
  const found = new Set<string>()
  await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetchFn(url, {
          headers: { 'User-Agent': auth.email, 'Authorization-Key': auth.key, accept: 'application/json' },
          signal: AbortSignal.timeout(12_000),
        })
        if (!res.ok) return
        const jobs = parseUsajobs(await res.json(), now)
        if (!jobs.length) return
        await syncBoard(db as never, USAJOBS_BOARD, jobs.map((j) => toJobRow(j, now)), { complete: false, now })
        for (const j of jobs) found.add(j.key)
      } catch {
        // USAJOBS being slow never stops the rest of the match.
      }
    })
  )
  return found.size
}
