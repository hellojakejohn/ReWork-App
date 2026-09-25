// Types for the tailor pipeline: master resume -> model input -> model output -> fact guard.
// Kept free of runtime imports so fact-guard and tests can use them without pulling in OpenAI.

// What we send to the model. Contact info is deliberately absent.
export interface TailorInputRole {
  id: string
  title: string
  company: string
  startDate: string
  endDate: string
  location: string
  bullets: string[]
}

export interface TailorInputEducation {
  id: string
  degree: string
  field: string
  institution: string
  graduationYear: string
  details: string[]
}

export interface TailorInputProject {
  id: string
  name: string
  description: string
  technologies: string[]
  bullets: string[]
}

export interface TailorInput {
  summary: string
  roles: TailorInputRole[]
  education: TailorInputEducation[]
  projects: TailorInputProject[]
  skills: string[]
}

// What the model returns (enforced by the JSON schema in src/lib/tailor.ts).
export interface TailoredBullet {
  text: string
  reason: string
}

export interface TailorOutputRole {
  id: string
  title: string
  company: string
  startDate: string
  endDate: string
  bullets: TailoredBullet[]
}

export interface TailorOutputEducation {
  id: string
  degree: string
  institution: string
  graduationYear: string
}

export interface TailorOutputProject {
  id: string
  name: string
  description: string
  bullets: TailoredBullet[]
}

export interface TailorOutput {
  targetKeywords: string[]
  summary: string
  roles: TailorOutputRole[]
  education: TailorOutputEducation[]
  projects: TailorOutputProject[]
  skills: string[]
}

export type FactGuardWarningType =
  | 'fact_restored' // company/title/dates/name changed by the model, master value restored
  | 'entry_restored' // model dropped a role/education/project, restored from master
  | 'entry_discarded' // model invented a role/education/project, discarded
  | 'new_number' // bullet/summary introduced a number not in the master, reverted
  | 'skill_dropped' // skill not found anywhere in the master, dropped

export interface FactGuardWarning {
  type: FactGuardWarningType
  section: 'summary' | 'roles' | 'education' | 'projects' | 'skills'
  id?: string
  message: string
  attempted?: string
  restored?: string
}

export interface FactGuardResult {
  cleaned: TailorOutput
  warnings: FactGuardWarning[]
}

export interface KeywordCoverage {
  score: number // 0-100
  present: string[]
  missing: string[]
}

// Stored on JobApplication.categoryScores
export interface TailorCategoryScores {
  keywordCoverageMaster: number
  keywordCoverageTailored: number
}

// Stored on JobApplication.suggestions
export interface TailorReport {
  version: 'tailor-v2'
  model: string
  warnings: FactGuardWarning[]
  missingKeywords: string[]
  bulletReasons: Record<string, TailoredBullet[]> // keyed by role/project id
}
