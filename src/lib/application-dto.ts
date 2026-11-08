// What the client gets for a tailored resume (a JobApplication row).
import { masterToParsed } from '@/lib/master-resume'
import type { ApplicationStatus } from '@prisma/client'
import type { ParsedResume } from '@/types/parsed-resume'
import { readStoredCoverLetter, type StoredCoverLetter } from '@/lib/cover-letter-shared'
import { readStoredAnswers, type StoredAnswer } from '@/lib/app-answers-shared'
import type { BulletChange, FactGuardWarning, KeywordCoverage, TailorCategoryScores, TailorOutput, TailorReport } from '@/types/tailor'
import { buildTailorInput, type MasterResume } from '@/lib/tailor'
import { coverageReport } from '@/lib/keyword-coverage'
import { outputWithDecisions } from '@/lib/tailor-changes'
import { payFromText } from '@/lib/pay'

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

/** One card on the tracker. */
export interface TrackerCardDTO extends ApplicationSummaryDTO {
  status: ApplicationStatus
  statusUpdatedAt: string
  appliedAt: string | null
  notes: string
  followUpAt: string | null // YYYY-MM-DD
  tailored: boolean
  hasCoverLetter: boolean
  /** Pay the job post names ("$120k to $150k a year"), null when it names none. */
  pay: string | null
}

export interface ApplicationDetailDTO extends ApplicationSummaryDTO {
  jobDescription: string
  jobLocation: string
  tailored: ParsedResume
  changes: BulletChange[]
  keywords: { target: string[]; presentBefore: string[]; presentAfter: string[]; related: string[]; missing: string[] }
  warnings: FactGuardWarning[]
  coverLetter: StoredCoverLetter | null
  coverLetterUpdatedAt: string | null
  /** Application answers, newest first (kept in suggestions.answers). */
  answers: StoredAnswer[]
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
  originalContent?: unknown
  optimizedContent?: unknown
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

/**
 * Coverage re-scored with today's matcher from what the row stores (the master snapshot and
 * the tailored output with the user's Accept/Revert choices), so results saved before a
 * matcher change don't show stale lists ("Front-End missing" for "frontends"). Null when
 * the row doesn't carry its contents.
 */
function freshCoverage(row: ApplicationRowLike, report: Partial<TailorReport>, target: string[]): { master: KeywordCoverage; tailored: KeywordCoverage } | null {
  const cleaned = row.optimizedContent as TailorOutput | null | undefined
  if (!target.length || !row.originalContent || !cleaned?.roles) return null
  try {
    const output = outputWithDecisions({ ...cleaned, targetKeywords: target }, report.changes ?? [])
    return coverageReport(buildTailorInput(row.originalContent as MasterResume), output)
  } catch {
    return null
  }
}

export function toApplicationDetail(row: ApplicationRowLike): ApplicationDetailDTO {
  const report = (row.suggestions ?? {}) as Partial<TailorReport>
  const target = report.targetKeywords ?? row.keywords ?? []
  const fresh = freshCoverage(row, report, target)
  if (fresh) {
    return withKeywords(row, report, target, {
      coverageBefore: fresh.master.score,
      coverageAfter: fresh.tailored.score,
      presentBefore: fresh.master.present,
      presentAfter: fresh.tailored.present,
      related: fresh.tailored.related,
      missing: fresh.tailored.missing,
    })
  }
  const missing = report.missingKeywords ?? []
  const summary = toApplicationSummary(row)
  return withKeywords(row, report, target, {
    coverageBefore: summary.coverageBefore,
    coverageAfter: summary.coverageAfter,
    presentBefore: report.presentBefore ?? [],
    presentAfter: report.presentAfter ?? target.filter((k) => !missing.includes(k)),
    related: report.relatedAfter ?? [],
    missing,
  })
}

function withKeywords(
  row: ApplicationRowLike,
  report: Partial<TailorReport>,
  target: string[],
  k: { coverageBefore: number | null; coverageAfter: number | null; presentBefore: string[]; presentAfter: string[]; related: string[]; missing: string[] }
): ApplicationDetailDTO {
  return {
    ...toApplicationSummary(row),
    coverageBefore: k.coverageBefore,
    coverageAfter: k.coverageAfter,
    jobDescription: row.jobDescription ?? '',
    jobLocation: report.jobLocation ?? '',
    tailored: masterToParsed((row.optimizedStructured ?? {}) as Record<string, unknown>),
    changes: report.changes ?? [],
    keywords: { target, presentBefore: k.presentBefore, presentAfter: k.presentAfter, related: k.related, missing: k.missing },
    warnings: Array.isArray(report.warnings) ? report.warnings : [],
    coverLetter: readStoredCoverLetter(row.coverLetter),
    coverLetterUpdatedAt: row.coverLetterUpdatedAt ? row.coverLetterUpdatedAt.toISOString() : null,
    answers: readStoredAnswers((report as Record<string, unknown>).answers),
  }
}

interface TrackerRowLike extends ApplicationRowLike {
  status: ApplicationStatus
  statusUpdatedAt: Date | null
  updatedAt: Date
  appliedAt: Date | null
  notes: string | null
  followUpAt: Date | null
}

export function toTrackerCard(row: TrackerRowLike): TrackerCardDTO {
  return {
    ...toApplicationSummary(row),
    status: row.status,
    statusUpdatedAt: (row.statusUpdatedAt ?? row.createdAt).toISOString(),
    appliedAt: row.appliedAt ? row.appliedAt.toISOString() : null,
    notes: row.notes ?? '',
    followUpAt: row.followUpAt ? row.followUpAt.toISOString().slice(0, 10) : null,
    tailored: !!row.optimizedStructured,
    hasCoverLetter: !!row.coverLetter,
    pay: payFromText(row.jobDescription)?.label ?? null,
  }
}
