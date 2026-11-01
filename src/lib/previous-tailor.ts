// "You tailored this job already": the user's latest tailored result for the same resume
// and job, so the Tailor card can offer to open it instead of spending another tailor.
// Same job = same link (tracking stripped), or the same title at the same company. Pure.
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

export function previousTailor<T extends Tailored>(
  applications: T[],
  resumeId: string,
  job: { url: string; title: string; company: string }
): T | null {
  const url = job.url.trim() ? cleanJobUrl(job.url) : ''
  const matches = applications.filter((a) => {
    if (a.resumeId !== resumeId) return false
    if (url && a.jobUrl && cleanJobUrl(a.jobUrl) === url) return true
    return !!norm(job.title) && norm(a.jobTitle) === norm(job.title) && !!norm(job.company) && norm(a.company) === norm(job.company)
  })
  return matches.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
}
