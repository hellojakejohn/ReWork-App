// Where a signup came from: the link's ?ref= or utm_* tags, else the referring site, else
// "direct". Middleware remembers it in one first-party cookie (30 days) for visitors who
// aren't signed in, and the signed_up event copies it, so /admin can show signups and
// payers by source. Edge-safe and pure: no Prisma, no Node APIs.
//
// Privacy: only short tags and the referring site's host are kept, never a full URL,
// query string or anything about the person.

export const SOURCE_COOKIE = 'rw_src'
export const SOURCE_COOKIE_DAYS = 30

export interface SignupSource {
  /** x, linkedin, reddit, google, a ?ref= tag, or "direct". */
  s: string
  /** utm_medium, if tagged. */
  m?: string
  /** utm_campaign, if tagged. */
  c?: string
  /** First page they landed on, path only. */
  p?: string
  /** True when the link was tagged (ref or utm), so it can replace an untagged visit. */
  t?: boolean
}

const TAG = /[^a-z0-9._-]/g

/** Lowercase, safe characters only, at most 40 long. Empty becomes undefined. */
export function cleanTag(value: string | null | undefined): string | undefined {
  const out = (value ?? '').trim().toLowerCase().replace(TAG, '').slice(0, 40)
  return out || undefined
}

// Referring hosts we name ourselves, so "t.co" and "x.com" both count as x.
const KNOWN_HOSTS: [RegExp, string][] = [
  [/(^|\.)(t\.co|x\.com|twitter\.com)$/, 'x'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'linkedin'],
  [/(^|\.)(reddit\.com|redd\.it)$/, 'reddit'],
  [/(^|\.)news\.ycombinator\.com$/, 'hackernews'],
  [/(^|\.)producthunt\.com$/, 'producthunt'],
  [/(^|\.)indiehackers\.com$/, 'indiehackers'],
  [/(^|\.)(facebook\.com|fb\.com|instagram\.com|threads\.net)$/, 'meta'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
  [/(^|\.)chatgpt\.com$/, 'chatgpt'],
  [/(^|\.)claude\.ai$/, 'claude'],
]

/** The referring site as a short name, or null when there's none or it's us. */
export function referrerSource(referer: string | null | undefined, ownHost: string): string | null {
  if (!referer) return null
  let host: string
  try {
    host = new URL(referer).hostname.toLowerCase()
  } catch {
    return null
  }
  const bare = host.replace(/^www\./, '')
  const own = ownHost.toLowerCase().replace(/^www\./, '')
  if (!bare || bare === own || bare.endsWith(`.${own}`)) return null
  for (const [re, name] of KNOWN_HOSTS) if (re.test(bare)) return name
  return cleanTag(bare) ?? null
}

/** The source for one page visit. */
export function sourceFromVisit(url: URL, referer: string | null | undefined): SignupSource {
  const q = url.searchParams
  const tagged = cleanTag(q.get('ref')) ?? cleanTag(q.get('utm_source')) ?? (q.get('invite') ? 'invite' : undefined)
  const s = tagged ?? referrerSource(referer, url.hostname) ?? 'direct'
  const out: SignupSource = { s, p: url.pathname.slice(0, 60) }
  const m = cleanTag(q.get('utm_medium'))
  const c = cleanTag(q.get('utm_campaign'))
  if (m) out.m = m
  if (c) out.c = c
  if (tagged) out.t = true
  return out
}

export function encodeSource(source: SignupSource): string {
  return encodeURIComponent(JSON.stringify(source))
}

export function decodeSource(value: string | null | undefined): SignupSource | null {
  if (!value) return null
  try {
    const raw = JSON.parse(decodeURIComponent(value)) as Record<string, unknown>
    const s = cleanTag(typeof raw.s === 'string' ? raw.s : undefined)
    if (!s) return null
    const out: SignupSource = { s }
    const m = cleanTag(typeof raw.m === 'string' ? raw.m : undefined)
    const c = cleanTag(typeof raw.c === 'string' ? raw.c : undefined)
    if (m) out.m = m
    if (c) out.c = c
    if (typeof raw.p === 'string' && raw.p.startsWith('/')) out.p = raw.p.slice(0, 60)
    if (raw.t === true) out.t = true
    return out
  } catch {
    return null
  }
}

/**
 * Whether this visit should replace what the cookie holds: always when there's nothing
 * yet, and when a tagged link follows an untagged visit (they came back from our post).
 * Otherwise the first touch wins.
 */
export function shouldRemember(existing: SignupSource | null, visit: SignupSource): boolean {
  if (!existing) return true
  return !existing.t && !!visit.t
}

/** Props for the signed_up event. */
export function sourceProps(source: SignupSource | null): Record<string, string> {
  if (!source) return { source: 'unknown' }
  const out: Record<string, string> = { source: source.s }
  if (source.m) out.medium = source.m
  if (source.c) out.campaign = source.c
  if (source.p) out.landing = source.p
  return out
}
