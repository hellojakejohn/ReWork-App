// "Save to ReWork": a job read from the page the user has open (LinkedIn, Indeed, any job
// page) in their own browser. ReWork's server never fetches those sites. The bookmarklet
// opens /save#job=<json>; /save keeps it in localStorage (so it survives sign-in) and the
// dashboard picks it up on the Job card for the user to check. Safe for the client.
import { INPUT_LIMITS } from '@/lib/plans'

export const SAVED_JOB_KEY = 'rework.savedJob'
// A saved job older than this is stale (an abandoned sign-in): ignore it.
export const SAVED_JOB_MAX_AGE_MS = 60 * 60 * 1000

export interface SavedJob {
  url: string
  title: string
  company: string
  location: string
  description: string
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\u0000/g, '').trim().slice(0, max) : ''
}

function httpUrl(value: unknown): string {
  const raw = text(value, 2000)
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : ''
  } catch {
    return ''
  }
}

/** Any page can open /save, so treat the payload as untrusted: strings only, capped. */
export function cleanSavedJob(value: unknown): SavedJob | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const job: SavedJob = {
    url: httpUrl(v.url),
    title: text(v.title, 200),
    company: text(v.company, 200),
    location: text(v.location, 200),
    // Over the limit still loads; the Job card shows the limit message.
    description: text(v.description, INPUT_LIMITS.jobDescriptionChars + 1),
  }
  return job.description.length >= 50 ? job : null
}

/** Reads `#job=<encoded json>` from a location hash. */
export function savedJobFromHash(hash: string): SavedJob | null {
  const match = /^#?job=(.*)$/s.exec(hash)
  if (!match) return null
  try {
    return cleanSavedJob(JSON.parse(decodeURIComponent(match[1])))
  } catch {
    return null
  }
}

export function storeSavedJob(job: SavedJob, now = Date.now()): void {
  try {
    window.localStorage.setItem(SAVED_JOB_KEY, JSON.stringify({ ...job, savedAt: now }))
  } catch {
    // Private mode or blocked storage: the dashboard just won't have it.
  }
}

/** Returns the saved job once and removes it. */
export function takeSavedJob(now = Date.now()): SavedJob | null {
  try {
    const raw = window.localStorage.getItem(SAVED_JOB_KEY)
    if (!raw) return null
    window.localStorage.removeItem(SAVED_JOB_KEY)
    const parsed = JSON.parse(raw)
    if (typeof parsed?.savedAt !== 'number' || now - parsed.savedAt > SAVED_JOB_MAX_AGE_MS) return null
    return cleanSavedJob(parsed)
  } catch {
    return null
  }
}
