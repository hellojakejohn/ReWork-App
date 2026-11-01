// "You tailored this job already": the user's latest tailored result for the same resume
// and job, so the Tailor card can offer to open it instead of spending another tailor.
// Same job = same link (tracking stripped), or the same title at the same company, read
// loosely: "Sr. Applications Developer (Full Stack)" at "trane technologies" matches
// "Sr. Applications Developer" at "Trane" (a pasted post vs the same post read from its link). Pure.
import { cleanJobUrl } from '@/lib/job-url'

interface Tailored {
  id: string
  resumeId: string
  jobTitle: string
  company: string
  jobUrl: string | null
  createdAt: string
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
const CORPORATE = /\b(inc|llc|ltd|corp|corporation|co|company|technologies|technology|group|holdings|plc|gmbh)\b\.?/gi

/** Title without "(Full Stack)" / "[Remote]" / " - Remote" asides. */
const titleKey = (t: string) => norm(t.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/\s[-–|]\s.*$/, ''))

/** Company without Inc/Technologies/Group: "Trane Technologies plc" -> "trane". */
const companyKey = (c: string) => norm(c.replace(CORPORATE, ' '))

function sameTitle(a: string, b: string): boolean {
  const x = titleKey(a)
  const y = titleKey(b)
  return x.length >= 3 && x === y
}

function sameCompany(a: string, b: string): boolean {
  const x = companyKey(a)
  const y = companyKey(b)
  return x.length >= 2 && x === y
}

export function previousTailor<T extends Tailored>(
  applications: T[],
  resumeId: string,
  job: { url: string; title: string; company: string }
): T | null {
  const url = job.url.trim() ? cleanJobUrl(job.url) : ''
  const matches = applications.filter((a) => {
    if (a.resumeId !== resumeId) return false
    if (url && a.jobUrl && cleanJobUrl(a.jobUrl) === url) return true
    return sameTitle(a.jobTitle, job.title) && sameCompany(a.company, job.company)
  })
  return matches.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
}
