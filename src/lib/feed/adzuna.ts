// Adzuna (a job search engine that gathers ads from many boards) for matches on upload.
// It fills the gap the company boards leave: warehouse, retail, care, trades, office and
// hospital jobs near the person. Searched at match time, like Workday and USAJOBS, with the
// person's target title, in their state, plus a "remote" search. Free API, but it needs keys:
// off unless ADZUNA_APP_ID and ADZUNA_APP_KEY are set.
// https://developer.adzuna.com/docs/search
//
// The answer only has a short preview of each ad (a few hundred characters), so these jobs
// are marked `preview`: picking one asks for the full post before tailoring. Links stay
// Adzuna's redirect link (their terms), which lands on the original ad.
import type { PrismaClient } from '@prisma/client'
import { syncBoard, toJobRow } from './sync'
import { stateName, US_STATE_CODES } from './prefilter'
import type { FeedJob } from './boards'

type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any
type Db = Pick<PrismaClient, 'job'>

export const ADZUNA_BOARD = 'adzuna:search'
export const ADZUNA_SOURCE = 'adzuna'
const API = 'https://api.adzuna.com/v1/api/jobs/us/search/1'

export interface AdzunaAuth {
  appId: string
  appKey: string
}

export function adzunaConfigured(env: NodeJS.ProcessEnv = process.env): AdzunaAuth | null {
  const appId = env.ADZUNA_APP_ID?.trim()
  const appKey = env.ADZUNA_APP_KEY?.trim()
  return appId && appKey ? { appId, appKey } : null
}

/** One search per title: in their state unless remote-only, and "remote" unless near-only. Keys are added at fetch time. */
export function adzunaQueries(titles: string[], workplace: 'remote' | 'near' | 'both', homeState: string | null): string[] {
  const state = homeState ? stateName(homeState) : null
  const out: string[] = []
  for (const t of titles) {
    const base = { results_per_page: '50', sort_by: 'date', max_days_old: '30', 'content-type': 'application/json' }
    if (workplace !== 'remote' && state) out.push(`${API}?${new URLSearchParams({ ...base, what: t, where: state })}`)
    if (workplace !== 'near' || !state) out.push(`${API}?${new URLSearchParams({ ...base, what: t, what_and: 'remote' })}`)
  }
  return out
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
/** Adzuna wraps search words in <strong> and sends entities. Plain text only. */
const plain = (v: unknown) =>
  str(v)
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** "Saint Paul, MN" from the area list ["US", "Minnesota", "Ramsey County", "Saint Paul"]. */
function place(loc: Json): string {
  const area: string[] = Array.isArray(loc?.area) ? loc.area.map(str).filter(Boolean) : []
  const state = area[1] ? US_STATE_CODES[area[1].toLowerCase()] : undefined
  const city = area.length > 3 ? area[area.length - 1] : ''
  if (state && city) return `${city}, ${state}`
  if (state) return area[1]
  if (area.length === 1 && area[0] === 'US') return 'United States'
  return plain(loc?.display_name)
}

/** "Pay: $52,000 to $61,000 a year", only when the employer gave it (not Adzuna's estimate). */
function payLine(r: Json): string {
  if (str(r?.salary_is_predicted) === '1') return ''
  const min = Number(r?.salary_min)
  const max = Number(r?.salary_max)
  if (!(min > 0)) return ''
  // Adzuna gives yearly figures; small ones are hourly rates.
  const hourly = (max || min) < 200
  const fmt = (n: number) => `$${n.toLocaleString('en-US', hourly && n % 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 })}`
  const range = max > min ? `${fmt(min)} to ${fmt(max)}` : fmt(min)
  return `Pay: ${range} ${hourly ? 'an hour' : 'a year'}`
}

/** The search answer as feed jobs. */
export function parseAdzuna(data: Json): (Omit<FeedJob, 'facts'> & { postedAt: Date | null; facts: FeedJob['facts'] })[] {
  const results: Json[] = Array.isArray(data?.results) ? data.results : []
  const out: (Omit<FeedJob, 'facts'> & { postedAt: Date | null; facts: FeedJob['facts'] })[] = []
  for (const r of results) {
    const id = str(r?.id)
    const title = plain(r?.title)
    const url = str(r?.redirect_url)
    if (!id || !title || !/^https:\/\//.test(url)) continue
    const where = place(r?.location)
    const pay = payLine(r)
    const remote = /\bremote\b/i.test(`${title} ${str(r?.description).slice(0, 300)}`)
    const created = str(r?.created)
    const postedAt = created && !Number.isNaN(new Date(created).getTime()) ? new Date(created) : null
    out.push({
      key: `adzuna:${id}`,
      board: ADZUNA_BOARD,
      source: ADZUNA_SOURCE,
      title: title.slice(0, 300),
      company: plain(r?.company?.display_name) || 'Company not listed',
      location: remote && !/remote/i.test(where) ? (where ? `${where}, Remote` : 'Remote') : where,
      description: [pay, plain(r?.description)].filter(Boolean).join('\n\n'),
      url,
      postedAt,
      facts: { posted: postedAt ? postedAt.toISOString().slice(0, 10) : undefined, pay: !!pay },
    })
  }
  return out
}

/** Run the searches and keep what comes back. Returns how many different jobs. */
export async function searchAdzuna(
  db: Db,
  urls: string[],
  { fetchFn = fetch, now = new Date(), auth = adzunaConfigured() }: { fetchFn?: typeof fetch; now?: Date; auth?: AdzunaAuth | null } = {}
): Promise<number> {
  if (!auth || urls.length === 0) return 0
  const found = new Set<string>()
  await Promise.all(
    urls.map(async (url) => {
      try {
        const u = new URL(url)
        u.searchParams.set('app_id', auth.appId)
        u.searchParams.set('app_key', auth.appKey)
        const res = await fetchFn(u.toString(), { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(12_000) })
        if (!res.ok) return
        const jobs = parseAdzuna(await res.json())
        if (!jobs.length) return
        await syncBoard(db as never, ADZUNA_BOARD, jobs.map((j) => toJobRow(j, now)), { complete: false, now })
        for (const j of jobs) found.add(j.key)
      } catch {
        // Adzuna being slow or out of calls never stops the rest of the match.
      }
    })
  )
  return found.size
}
