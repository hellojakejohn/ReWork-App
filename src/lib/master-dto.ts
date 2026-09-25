// What the client gets for a master resume: one normalized shape, whatever the row's age.
import { masterToParsed } from '@/lib/master-resume'
import type { NeedsReviewItem, ParsedResume } from '@/types/parsed-resume'

export interface MasterResumeDTO {
  id: string
  title: string
  originalFileName: string | null
  createdAt: string
  updatedAt: string
  resume: ParsedResume
  needsReview: NeedsReviewItem[]
}

interface ResumeRowLike {
  id: string
  title: string
  originalFileName?: string | null
  createdAt: Date
  updatedAt: Date
  originalContent?: unknown
  contactInfo?: unknown
  professionalSummary?: unknown
  workExperience?: unknown
  education?: unknown
  skills?: unknown
  projects?: unknown
  additionalSections?: unknown
}

export function needsReviewOf(originalContent: unknown): NeedsReviewItem[] {
  const parse = (originalContent as { parse?: { needsReview?: unknown } } | null)?.parse
  return Array.isArray(parse?.needsReview) ? (parse!.needsReview as NeedsReviewItem[]) : []
}

export function toMasterDTO(row: ResumeRowLike): MasterResumeDTO {
  return {
    id: row.id,
    title: row.title,
    originalFileName: row.originalFileName ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resume: masterToParsed(row),
    needsReview: needsReviewOf(row.originalContent),
  }
}

/** A master is usable for tailoring once it has at least one role, project or school. */
export function hasContent(resume: ParsedResume): boolean {
  return resume.experience.length + resume.projects.length + resume.education.length > 0
}
