// Skill check types and limits, safe for the client. The server half is skill-check.ts.

export type SkillLevel = 'no' | 'some' | 'yes'

export interface SkillAnswer {
  keyword: string
  level: SkillLevel
  note: string // where or how, in the user's words; may be empty
}

// Where an answer lands: the keyword in a skills group, a new bullet on a role or project,
// or a line in a Training section (classes, courses, self-study).
export type SkillAdditionKind = 'skill' | 'bullet' | 'training'

export interface SkillAddition {
  keyword: string
  kind: SkillAdditionKind
  target: string // skill group name, or role/project id for a bullet; '' for training
  targetLabel: string // what the UI shows: "Skills: Design", "ReWork", "Training"
  text: string
}

export interface FitCoverage {
  score: number
  present: string[]
  missing: string[]
}

export const MAX_SKILL_QUESTIONS = 16
export const MAX_SKILL_NOTE = 240
export const TRAINING_HEADING = 'Training'

// Below this share of the job's keywords the Tailor card says the job is a stretch.
export const LOW_FIT_SCORE = 40
