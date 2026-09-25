// What the client gets for a tailored resume (a JobApplication row).
import { masterToParsed } from '@/lib/master-resume'
import type { ParsedResume } from '@/types/parsed-resume'
import { readStoredCoverLetter, type StoredCoverLetter } from '@/lib/cover-letter-shared'
import type { BulletChange, FactGuardWarning, TailorCategoryScores, TailorReport } from '@/types/tailor'

export interface ApplicationSummaryDTO {
  id: string
  resumeId: string
  jobTitle: string
  company: string
  jobUrl: string | null
  createdAt: string
  coverageBefore: number | null
  coverageAfter: number | null
}

export interface ApplicationDetailDTO extends ApplicationSummaryDTO {
  jobDescription: string
  jobLocation: string
  tailored: ParsedResume
  changes: BulletChange[]
  keywords: { target: string[]; presentBefore: string[]; presentAfter: string[]; missing: string[] }
  warnings: FactGuardWarning[]
  coverLetter: StoredCoverLetter | null
  coverLetterUpdatedAt: string | null
}

interface ApplicationRowLike {
  id: string
  resumeId: string
  jobTitle: string
  company: string
  jobUrl: string | null
  jobDescription?: string
  createdAt: Date
  matchScore: number | null
  categoryScores?: unknown
  keywords?: string[]
  suggestions?: unknown
  optimizedStructured?: unknown
  coverLetter?: unknown
  coverLetterUpdatedAt?: Date | null
}

export function toApplicationSummary(row: ApplicationRowLike): ApplicationSummaryDTO {
  const scores = (row.categoryScores ?? null) as Partial<TailorCategoryScores> | null
  return {
    id: row.id,
    resumeId: row.resumeId,
    jobTitle: row.jobTitle,
    company: row.company,
    jobUrl: row.jobUrl,
    createdAt: row.createdAt.toISOString(),
    coverageBefore: typeof scores?.keywordCoverageMaster === 'number' ? scores.keywordCoverageMaster : null,
    coverageAfter: typeof scores?.keywordCoverageTailored === 'number' ? scores.keywordCoverageTailored : row.matchScore,
  }
}

export function toApplicationDetail(row: ApplicationRowLike): ApplicationDetailDTO {
  const report = (row.suggestions ?? {}) as Partial<TailorReport>
  const target = report.targetKeywords ?? row.keywords ?? []
  const missing = report.missingKeywords ?? []
  return {
    ...toApplicationSummary(row),
    jobDescription: row.jobDescription ?? '',
    jobLocation: report.jobLocation ?? '',
    tailored: masterToParsed((row.optimizedStructured ?? {}) as Record<string, unknown>),
    changes: report.changes ?? [],
    keywords: {
      target,
      presentBefore: report.presentBefore ?? [],
      presentAfter: report.presentAfter ?? target.filter((k) => !missing.includes(k)),
      missing,
    },
    warnings: Array.isArray(report.warnings) ? report.warnings : [],
    coverLetter: readStoredCoverLetter(row.coverLetter),
    coverLetterUpdatedAt: row.coverLetterUpdatedAt ? row.coverLetterUpdatedAt.toISOString() : null,
  }
}
