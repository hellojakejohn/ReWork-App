// Why a job is a match, in three short parts: title, skills, level. Worked out when the list
// loads (no model, nothing stored), from the same rules the matcher ranks with.
import { JUNIOR_RE, SENIOR_RE, titleWords } from './prefilter'

export interface MatchWhy {
  title: { fit: 'close' | 'partly' | 'different'; wanted: string | null }
  /** Key skills of the job: shown in its words, shown in other words, out of all. */
  skills: { have: number; other: number; of: number }
  level: { fits: boolean; note: string }
}

/** wanted: the titles they search for (target titles, else latest title). years: from the resume. */
export function matchWhy(
  jobTitle: string,
  m: { present: string[]; related: string[]; missing: string[] },
  wanted: string[],
  years: number
): MatchWhy {
  const job = new Set(titleWords(jobTitle))
  let best = 0
  let bestTitle: string | null = wanted[0] ?? null
  for (const t of wanted) {
    const words = [...new Set(titleWords(t))]
    const fit = words.length ? words.filter((w) => job.has(w)).length / words.length : 0
    if (fit > best) [best, bestTitle] = [fit, t]
  }
  const fit = best >= 0.99 ? 'close' : best > 0 ? 'partly' : 'different'

  const of = m.present.length + m.related.length + m.missing.length
  const skills = { have: m.present.length, other: m.related.length, of }

  const yrs = `${years} year${years === 1 ? '' : 's'}`
  let level: MatchWhy['level']
  if (SENIOR_RE.test(jobTitle)) level = years >= 5 ? { fits: true, note: `Senior role, fits your ${yrs}` } : { fits: false, note: `Senior role, your resume shows ${yrs}` }
  else if (JUNIOR_RE.test(jobTitle)) level = years >= 3 ? { fits: false, note: `Entry level, below your ${yrs}` } : { fits: true, note: 'Entry level, fits where you are' }
  else level = { fits: true, note: 'No level in the title' }

  return { title: { fit, wanted: bestTitle }, skills, level }
}
