// Job feed spike: the free first pass (no model). Scores a job against one resume by title,
// skills found in the post, seniority and location, so only the likely jobs get the paid
// keyword extraction. Deliberately loose: it ranks, the Job match decides.
import { hasKeyword } from '@/lib/keyword-coverage'
import type { ParsedResume } from '@/types/parsed-resume'

export interface FeedPrefs {
  /** Titles the person wants next ("Operations Coordinator"). Career changers need this. */
  targetTitles?: string[]
  /** Accept on-site jobs only near home (same US state). Remote is always fine. */
  onsiteNearHomeOnly?: boolean
}

export interface ResumeProfile {
  titleWords: Set<string>
  skills: string[]
  years: number
  homeState: string | null
}

export interface Prescore {
  score: number
  title: number
  skills: number
  skillHits: string[]
  remote: boolean
  dropped: string | null
}

const STOP = new Set(['and', 'of', 'the', 'for', 'to', 'in', 'a', 'an', 'with', 'i', 'ii', 'iii', 'iv', 'remote', 'us', 'usa', 'new', 'grad'])
const LEVEL = new Set(['senior', 'sr', 'staff', 'principal', 'lead', 'head', 'director', 'vp', 'chief', 'manager', 'junior', 'jr', 'associate', 'intern', 'mid', 'level'])
// Same job, different word. Kept tiny on purpose; the Job match does the real work.
const SAME: Record<string, string> = {
  developer: 'engineer',
  dev: 'engineer',
  swe: 'engineer',
  programmer: 'engineer',
  ops: 'operations',
  operational: 'operations',
  frontend: 'front',
  'front-end': 'front',
  backend: 'back',
  'back-end': 'back',
  fullstack: 'full',
  'full-stack': 'full',
}
// Senior titles a person with fewer years is unlikely to land (they still see them lower).
const SENIOR_RE = /\b(senior|sr\.?|staff|principal|lead|head of|director|vp|vice president|chief)\b/i
const JUNIOR_RE = /\b(intern|internship|new grad|junior|jr\.?|entry[- ]level|apprentice)\b/i

export function titleWords(title: string): string[] {
  return title
    .toLowerCase()
    // "General Manager" and "Assistant Manager" are one title, not "general" + a level.
    .replace(/\b(general|assistant|deputy) manager\b/g, 'gm')
    .replace(/[()[\],/|:&+]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[-.]+|[-.]+$/g, ''))
    .map((w) => SAME[w] ?? w)
    .filter((w) => w.length > 1 && !STOP.has(w) && !LEVEL.has(w) && !/^\d+$/.test(w))
}

const US_STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH',
  'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
  pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
}
const CODES = new Set(Object.values(US_STATES))

export function usState(location: string): string | null {
  if (/\b(d\.c\.?|dc|district of columbia)(?![a-z])/i.test(location)) return 'DC'
  const code = location.match(/,\s*([A-Z]{2})\b/)?.[1]
  if (code && CODES.has(code)) return code
  const lower = location.toLowerCase()
  for (const [name, c] of Object.entries(US_STATES)) if (new RegExp(`\\b${name}\\b`).test(lower)) return c
  const city = Object.entries(US_CITIES).find(([name]) => lower.includes(name))
  return city ? city[1] : null
}

// Big US job cities that boards often list without a state.
const US_CITIES: Record<string, string> = {
  'san francisco': 'CA', 'los angeles': 'CA', 'palo alto': 'CA', 'mountain view': 'CA', 'menlo park': 'CA', 'san jose': 'CA', 'san diego': 'CA', 'costa mesa': 'CA',
  'new york': 'NY', nyc: 'NY', seattle: 'WA', bellevue: 'WA', boston: 'MA', chicago: 'IL', austin: 'TX', dallas: 'TX', houston: 'TX', denver: 'CO',
  atlanta: 'GA', miami: 'FL', phoenix: 'AZ', portland: 'OR', minneapolis: 'MN', 'saint paul': 'MN', 'st. paul': 'MN', philadelphia: 'PA', pittsburgh: 'PA',
  nashville: 'TN', 'salt lake': 'UT', detroit: 'MI', reston: 'VA', arlington: 'VA',
}

export function isRemote(location: string, description = ''): boolean {
  return /\bremote\b|\banywhere\b|distributed/i.test(location) || /^\s*remote\b/i.test(description.slice(0, 200))
}

/**
 * US, somewhere else, or can't tell. The boards are global and our users are US first, so a
 * named place has to be recognisably American; "Remote", "Hybrid" or blank stay as unknown.
 */
export function locationCountry(location: string): 'us' | 'other' | 'unknown' {
  if (usState(location) || /\b(united states|usa|u\.s\.?|us|americas|north america|nationwide)\b/i.test(location)) return 'us'
  const rest = location.replace(/\b(remote|hybrid|in[- ]office|on[- ]site|onsite|anywhere|flexible|n\/a|multiple locations?|various)\b/gi, '').replace(/[\s,;:()/|•-]+/g, '')
  return rest ? 'other' : 'unknown'
}

function yearsOf(resume: ParsedResume, now = new Date()): number {
  let months = 0
  for (const e of resume.experience) {
    const start = e.startDate.match(/(\d{4})(?:-(\d{2}))?/)
    if (!start) continue
    const end = e.current || /present/i.test(e.endDate) ? null : e.endDate.match(/(\d{4})(?:-(\d{2}))?/)
    const s = Number(start[1]) * 12 + Number(start[2] ?? 1)
    const f = end ? Number(end[1]) * 12 + Number(end[2] ?? 12) : now.getFullYear() * 12 + now.getMonth() + 1
    if (f > s) months += f - s
  }
  return Math.round(months / 12)
}

export function resumeProfile(resume: ParsedResume, prefs: FeedPrefs = {}): ResumeProfile {
  const titles = prefs.targetTitles?.length ? prefs.targetTitles : resume.experience.slice(0, 2).map((e) => e.title)
  const skills = [...new Set([...resume.skills.flatMap((g) => g.items), ...resume.projects.flatMap((p) => p.tech)].map((s) => s.trim()).filter(Boolean))]
  return { titleWords: new Set(titles.flatMap(titleWords)), skills, years: yearsOf(resume), homeState: usState(resume.contact.location) }
}

export function prescore(job: { title: string; location: string; description: string }, profile: ResumeProfile, prefs: FeedPrefs = {}): Prescore {
  const remote = isRemote(job.location, job.description)
  const base = { title: 0, skills: 0, skillHits: [] as string[], remote, score: 0 }
  if (locationCountry(job.location) === 'other') return { ...base, dropped: 'outside the US' }
  if (prefs.onsiteNearHomeOnly && !remote && profile.homeState && usState(job.location) !== profile.homeState) return { ...base, dropped: 'on-site, not near home' }

  const words = titleWords(job.title)
  const shared = words.filter((w) => profile.titleWords.has(w))
  const title = words.length ? shared.length / Math.min(words.length, Math.max(profile.titleWords.size, 1)) : 0

  const text = `${job.title}\n${job.description}`
  const skillHits = profile.skills.filter((s) => hasKeyword(text, s))
  const skills = profile.skills.length ? Math.min(1, skillHits.length / Math.min(8, profile.skills.length)) : 0

  let score = 0.6 * Math.min(1, title) + 0.4 * skills
  if (SENIOR_RE.test(job.title) && profile.years < 5) score *= 0.6
  if (JUNIOR_RE.test(job.title) && profile.years >= 3) score *= 0.7
  return { title: Math.round(Math.min(1, title) * 100), skills: Math.round(skills * 100), skillHits, remote, score: Math.round(score * 100), dropped: null }
}
