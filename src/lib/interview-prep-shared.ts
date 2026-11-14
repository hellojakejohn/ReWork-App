// Interview prep: types safe for the client. The model call is in src/lib/interview-prep.ts.

export const PREP_QUESTIONS = 6

export interface PrepQuestion {
  question: string
  /** What the interviewer is checking, in one sentence. */
  why: string
  /** The candidate's own resume bullets that answer it, verbatim. Empty = a gap to prepare for. */
  bullets: string[]
  /** How to answer, from those bullets. No new facts. */
  angle: string
}

export interface StoredInterviewPrep {
  version: 1
  questions: PrepQuestion[]
  /** Good questions for the candidate to ask them. */
  askThem: string[]
  model: string
  generatedAt: string
}

export function readStoredInterviewPrep(value: unknown): StoredInterviewPrep | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<StoredInterviewPrep>
  if (!Array.isArray(v.questions)) return null
  return {
    version: 1,
    questions: v.questions
      .filter((q): q is PrepQuestion => !!q && typeof q.question === 'string')
      .map((q) => ({ question: q.question, why: q.why ?? '', bullets: Array.isArray(q.bullets) ? q.bullets.filter((b) => typeof b === 'string') : [], angle: q.angle ?? '' })),
    askThem: Array.isArray(v.askThem) ? v.askThem.filter((q) => typeof q === 'string') : [],
    model: v.model ?? '',
    generatedAt: v.generatedAt ?? '',
  }
}
