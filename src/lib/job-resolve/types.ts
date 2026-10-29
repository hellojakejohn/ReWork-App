import type { JobFacts } from '@/lib/job-checks'

export type JobSource =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workday'
  | 'smartrecruiters'
  | 'workable'
  | 'json-ld'
  | 'page'

export interface ResolvedJob {
  title: string
  company: string
  location: string
  description: string
  url: string
  source: JobSource
  /** Posting date, closing date and structured pay when the source has them (ghost-job signs). */
  facts?: JobFacts
}

export type NeedsPasteReason = 'linkedin' | 'blocked_site' | 'js_rendered' | 'blocked' | 'unreachable' | 'not_a_job'

export type ResolveResult =
  | { ok: true; job: ResolvedJob }
  | { ok: false; needsPaste: true; reason: NeedsPasteReason; message: string }
