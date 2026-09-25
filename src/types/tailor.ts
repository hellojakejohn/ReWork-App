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

export interface TailorInputSkillGroup {
  group: string
  items: string[]
}

export interface TailorInput {
  summary: string
  roles: TailorInputRole[]
  education: TailorInputEducation[]
  projects: TailorInputProject[]
  skills: string[] // every skill, flattened in group order
  skillGroups: TailorInputSkillGroup[] // the resume's own grouping, for context
  certifications: string[] // facts: never rewritten, only referenced
  // Facts the candidate gave in the evidence interview ("about 4,000 (about: <bullet>)").
  // Allowed like resume text, so their numbers pass the fact guard.
  evidence?: string[]
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

// One rewritten bullet (or the summary) as shown in the Changes tab. `before` is the master
// text it most likely came from. Accept keeps `after`; Revert puts `before` back.
export interface BulletChange {
  id: string // `${entryId}:${index}` or 'summary'
  section: 'summary' | 'roles' | 'projects'
  entryId: string
  entryLabel: string // "Frontend Developer at Acme" / project name / "Summary"
  index: number // position in the tailored entry's bullets; -1 for summary
  before: string
  after: string
  reason: string
  status: 'accepted' | 'reverted'
}

// Stored on JobApplication.suggestions
export interface TailorReport {
  version: 'tailor-v2' | 'tailor-v3'
  model: string
  warnings: FactGuardWarning[]
  missingKeywords: string[]
  bulletReasons: Record<string, TailoredBullet[]> // keyed by role/project id
  // tailor-v3+
  changes?: BulletChange[]
  targetKeywords?: string[]
  presentBefore?: string[]
  presentAfter?: string[]
  jobLocation?: string
}
