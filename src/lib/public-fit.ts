// The public fit check ("Take your measurements", /fit): paste a job, add a resume, see how
// well it fits. No account, nothing saved. Server only.
//
// Cost and abuse: the resume is read with plain text extraction (no model). The only model
// call is the job's keyword list, on the free-tier model, logged as a free ai_call so the
// global free ceiling covers it. On top: a daily cap on public checks for everyone, a
// per-visitor speed bump (route), and a small in-memory cache so the same job post is
// only read once per server instance.
import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { startOfUtcDay } from '@/lib/daily-ceiling'
import { keywordCoverage } from '@/lib/keyword-coverage'
import type { KeywordCoverage } from '@/types/tailor'
import { normalizeSpace } from '@/lib/resume-text'
import { verdictFor, type FitVerdict } from '@/lib/fit-words'

export { verdictFor }

export const PUBLIC_FIT_DAILY_MAX = 400
export const PUBLIC_FIT_LIMIT_MESSAGE = "The free fit check is busy today. Sign up free to check your fit on any job, or try again tomorrow."
export const MIN_JOB_CHARS = 200
export const MIN_RESUME_CHARS = 200

/** How many public fit checks ran today (UTC). Null if unreadable (fail closed). */
export async function publicFitsToday(now = new Date()): Promise<number | null> {
  try {
    return await prisma.event.count({ where: { name: 'fit_check_public', createdAt: { gte: startOfUtcDay(now) } } })
  } catch {
    return null
  }
}

export async function publicFitOpen(now = new Date()): Promise<boolean> {
  const count = await publicFitsToday(now)
  return count !== null && count < PUBLIC_FIT_DAILY_MAX
}

// ---------- job keyword cache (per server instance) ----------

const CACHE_MAX = 300
const cache = new Map<string, string[]>()

export function jobKey(description: string): string {
  return createHash('sha256').update(normalizeSpace(description).toLowerCase()).digest('hex')
}

export function cachedKeywords(key: string): string[] | null {
  const hit = cache.get(key)
  if (!hit) return null
  cache.delete(key)
  cache.set(key, hit)
  return hit
}

export function rememberKeywords(key: string, keywords: string[]): void {
  cache.set(key, keywords)
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string)
}

// ---------- the result ----------

export interface PublicFit extends KeywordCoverage {
  keywords: string[]
  /** A word for the score, tailor style. */
  verdict: FitVerdict
}

export function publicFit(keywords: string[], resumeText: string): PublicFit {
  const coverage = keywordCoverage(keywords, resumeText)
  return { ...coverage, keywords, verdict: verdictFor(coverage.score) }
}
