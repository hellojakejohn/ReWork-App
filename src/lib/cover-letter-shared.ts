// Cover letter types and constants safe to import from client components (no OpenAI).
export type CoverLetterTone = 'professional' | 'warm' | 'direct'
export const COVER_LETTER_TONES: { id: CoverLetterTone; label: string }[] = [
  { id: 'professional', label: 'Professional' },
  { id: 'warm', label: 'Warm' },
  { id: 'direct', label: 'Direct' },
]
export function isCoverLetterTone(value: unknown): value is CoverLetterTone {
  return value === 'professional' || value === 'warm' || value === 'direct'
}

export type CoverLetterWarningType = 'regenerated' | 'unsupported_fact' | 'banned_phrase' | 'greeting_reset' | 'length'

export interface CoverLetterWarning {
  type: CoverLetterWarningType
  message: string
  attempted?: string
}

// Stored on JobApplication.coverLetter
export interface StoredCoverLetter {
  version: 1
  tone: CoverLetterTone
  text: string // what the user sees and edits: blocks separated by blank lines
  warnings: CoverLetterWarning[]
  model: string
  generatedAt: string
  edited: boolean
}

/** Read a stored letter leniently (JSON column). */
export function readStoredCoverLetter(value: unknown): StoredCoverLetter | null {
  const v = value as Partial<StoredCoverLetter> | null
  if (!v || typeof v !== 'object' || typeof v.text !== 'string') return null
  return {
    version: 1,
    tone: isCoverLetterTone(v.tone) ? v.tone : 'professional',
    text: v.text,
    warnings: Array.isArray(v.warnings) ? v.warnings : [],
    model: typeof v.model === 'string' ? v.model : '',
    generatedAt: typeof v.generatedAt === 'string' ? v.generatedAt : '',
    edited: !!v.edited,
  }
}
