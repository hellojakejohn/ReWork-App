// Application answers: types and helpers safe for the client. The model call is in
// src/lib/app-answers.ts (server).

export type AnswerLength = 'short' | 'medium' | 'long'

export const ANSWER_LENGTHS: { id: AnswerLength; label: string; words: [number, number] }[] = [
  { id: 'short', label: 'Short', words: [40, 80] },
  { id: 'medium', label: 'Medium', words: [100, 160] },
  { id: 'long', label: 'Long', words: [200, 280] },
]

export const MAX_QUESTION_CHARS = 1000
export const MAX_ANSWER_CHARS = 4000
/** Saved answers per application. */
export const MAX_ANSWERS = 20

export function isAnswerLength(v: unknown): v is AnswerLength {
  return v === 'short' || v === 'medium' || v === 'long'
}

export interface AnswerWarning {
  type: 'unsupported_fact' | 'banned_phrase' | 'regenerated' | 'length'
  message: string
  attempted?: string
}

export interface StoredAnswer {
  id: string
  question: string
  answer: string
  length: AnswerLength
  /** What the user has to fill in themselves (salary, start date, visa): we never guess these. */
  needsYou: string | null
  warnings: AnswerWarning[]
  model: string
  generatedAt: string
  edited: boolean
}

/** Answers kept on the application row (suggestions.answers). Drops anything malformed. */
export function readStoredAnswers(value: unknown): StoredAnswer[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (a): a is StoredAnswer => !!a && typeof a === 'object' && typeof a.id === 'string' && typeof a.question === 'string' && typeof a.answer === 'string'
  ).map((a) => ({
    ...a,
    length: isAnswerLength(a.length) ? a.length : 'medium',
    needsYou: typeof a.needsYou === 'string' && a.needsYou.trim() ? a.needsYou : null,
    warnings: Array.isArray(a.warnings) ? a.warnings : [],
    edited: !!a.edited,
  }))
}

// Common application questions, as one-tap starters.
export const COMMON_QUESTIONS = [
  'Why do you want to work here?',
  'Why are you a good fit for this role?',
  'Tell us about a project you are proud of.',
  'Describe a challenge you faced at work and how you handled it.',
  'What makes you stand out from other candidates?',
]
