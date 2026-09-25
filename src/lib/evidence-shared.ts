// Evidence interview types and helpers safe for client components (no OpenAI).
// The interview itself lives in src/lib/evidence.ts.

export interface EvidenceQuestion {
  id: string
  text: string
}

/** One weak bullet from the master and the questions that would make it stronger. */
export interface EvidenceItem {
  id: string // `${entryId}:${index}`
  section: 'roles' | 'projects'
  entryId: string
  entryLabel: string
  index: number // position in the master entry's bullets
  bullet: string
  weakness: string // "No outcome", "Vague verb", ...
  questions: EvidenceQuestion[]
}

export interface EvidenceAnswer {
  itemId: string
  entryLabel: string
  bullet: string // the master bullet the answer is about
  questionId: string
  question: string
  answer: string
  answeredAt: string
}

// Stored on Resume.evidence. Answers stay even when the rewrite is rejected: they're the
// user's own facts and later tailoring/cover letters may use them.
export interface StoredEvidence {
  version: 1
  answers: EvidenceAnswer[]
  updatedAt: string
}

/** A before/after for one bullet, rewritten from the user's answers only. */
export interface EvidenceRewrite {
  itemId: string
  entryId: string
  section: 'roles' | 'projects'
  index: number
  entryLabel: string
  before: string
  after: string
  // Set when the fact guard rejected the model's rewrite and kept the original.
  warning?: string
}

const DONT_KNOW = /^(i\s+)?(don'?t|do not)\s+know\.?$|^(dunno|idk|n\/?a|na|none|not sure|no idea|unknown|skip|-+|\?+)\.?$/i

/** Empty or "don't know"-style answers carry no facts. */
export function isNonAnswer(answer: string): boolean {
  const a = answer.trim()
  return !a || DONT_KNOW.test(a)
}

export function readStoredEvidence(value: unknown): StoredEvidence {
  const v = value as Partial<StoredEvidence> | null
  const answers = Array.isArray(v?.answers)
    ? v!.answers.filter((a): a is EvidenceAnswer => !!a && typeof a.answer === 'string' && typeof a.bullet === 'string')
    : []
  return { version: 1, answers, updatedAt: typeof v?.updatedAt === 'string' ? v.updatedAt : '' }
}

/** The user's confirmed facts, one line each, for prompts and fact guards. */
export function evidenceFacts(value: unknown): string[] {
  return readStoredEvidence(value)
    .answers.filter((a) => !isNonAnswer(a.answer))
    .map((a) => `${a.answer.trim()} (about: ${a.bullet})`)
}

/** Merge new answers over old ones (same item + question replaces). */
export function mergeEvidence(existing: unknown, incoming: EvidenceAnswer[], now = new Date()): StoredEvidence {
  const current = readStoredEvidence(existing)
  const key = (a: EvidenceAnswer) => `${a.bullet}\u0000${a.question}`
  const byKey = new Map(current.answers.map((a) => [key(a), a]))
  for (const answer of incoming) byKey.set(key(answer), answer)
  return { version: 1, answers: [...byKey.values()], updatedAt: now.toISOString() }
}
