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
  /** Replaced by a newer upload: kept, listed in Manage resumes, not in the switcher. */
  hidden: boolean
  /** Read by the old regex extractor; the Resume card asks for a re-upload. */
  staleParse: boolean
}

export const CURRENT_PARSER_VERSION = '2'

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
  hiddenAt?: Date | null
  parserVersion?: string | null
  structuredDataVersion?: string | null
}

/** Rows from before the structured parser: no parserVersion and not saved as parse-v1. */
export function isStaleParse(row: { parserVersion?: string | null; structuredDataVersion?: string | null }): boolean {
  return !row.parserVersion && row.structuredDataVersion !== 'parse-v1'
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
    hidden: !!row.hiddenAt,
    staleParse: isStaleParse(row),
  }
}

/** A master is usable for tailoring once it has at least one role, project or school. */
export function hasContent(resume: ParsedResume): boolean {
  return resume.experience.length + resume.projects.length + resume.education.length > 0
}
