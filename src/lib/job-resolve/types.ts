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
}

export type NeedsPasteReason = 'blocked_site' | 'js_rendered' | 'blocked' | 'unreachable' | 'not_a_job'

export type ResolveResult =
  | { ok: true; job: ResolvedJob }
  | { ok: false; needsPaste: true; reason: NeedsPasteReason; message: string }
