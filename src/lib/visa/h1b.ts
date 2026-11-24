// H-1B filings by employer, from USCIS's public H-1B Employer Data Hub (built by
// scripts/build-h1b.ts into h1b-employers.json). A record of past approvals, not a promise
// that a job sponsors: copy always says so. Matching is by a cleaned-up name, so a company
// filing under a very different legal name can show "no record".
import data from './h1b-employers.json'

export interface H1bData {
  /** "FY2021-FY2023": the years counted. Empty before the data is built. */
  years: string
  /** employerKey -> approved H-1B workers (new + continuing) over those years. */
  employers: Record<string, number>
}

const H1B = data as H1bData

// Legal endings, always dropped from the end of a name.
const LEGAL = new Set(['llc', 'inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'ltd', 'limited', 'lp', 'llp', 'pc', 'pllc', 'plc', 'na', 'pa', 'sa', 'ag', 'gmbh', 'bv', 'us', 'usa'])
// Generic endings, dropped while a real name is left ("Amazon.com Services" -> "amazon").
const GENERIC = new Set(['services', 'service', 'svcs', 'svc', 'associates', 'technologies', 'technology', 'solutions', 'systems', 'international', 'intl', 'global', 'holdings', 'holding', 'group', 'labs', 'software', 'com', 'online', 'enterprises', 'worldwide'])

/** The name we match on: "Amazon.com Services LLC" and "Amazon" both give "amazon". */
export function employerKey(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    // "L.L.C.", "N.A.", "U.S." -> one word.
    .replace(/\b(l\.\s?l\.\s?[cp]|[nu]\.\s?[as]|p\.\s?c)\.?(?=[\s,]|$)/g, (m) => m.replace(/[.\s]/g, ''))
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  if (words[0] === 'the') words.shift()
  for (;;) {
    const last = words[words.length - 1]
    if (words.length > 1 && LEGAL.has(last)) words.pop()
    else if (words.length > 1 && GENERIC.has(last) && words.slice(0, -1).some((w) => !GENERIC.has(w) && !LEGAL.has(w))) words.pop()
    else break
  }
  return words.join(' ')
}

/** Both names a filing might be under: the legal name, and the trade name after "DBA". */
export function employerKeys(name: string): string[] {
  const [legal, dba] = name.split(/\s+(?:d\/?b\/?a|doing business as)\s+/i)
  return [...new Set([legal, dba].filter((s): s is string => !!s?.trim()).map(employerKey).filter(Boolean))]
}

export interface H1bRecord {
  /** Approved H-1B workers over `years`; 0 = none on record under this name. */
  approvals: number
  years: string
}

const compact = new WeakMap<H1bData, Map<string, number>>()
/** Employers by their name without spaces (largest count wins), built once per data set. */
function compactIndex(d: H1bData): Map<string, number> {
  let m = compact.get(d)
  if (!m) {
    m = new Map()
    for (const [k, n] of Object.entries(d.employers)) {
      const c = k.replace(/ /g, '')
      if (n > (m.get(c) ?? 0)) m.set(c, n)
    }
    compact.set(d, m)
  }
  return m
}

/** This company's H-1B record, or null when the data isn't built (nothing to say). */
export function h1bRecord(company: string, d: H1bData = H1B): H1bRecord | null {
  if (!d.years || !company.trim()) return null
  const keys = employerKeys(company)
  // "Wal Mart" on file, "Walmart" on the board: fall back to the name without spaces.
  const approvals = Math.max(0, ...keys.map((k) => d.employers[k] ?? compactIndex(d).get(k.replace(/ /g, '')) ?? 0))
  return { approvals, years: d.years }
}
