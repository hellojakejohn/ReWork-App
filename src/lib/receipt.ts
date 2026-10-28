// "Your receipt" on the Result card: what the tailor kept, added and left out, counted
// from the saved tailor report (changes, keyword coverage, fact-guard warnings). Pure and
// client-safe. Nothing here is estimated: a count the report doesn't support is null.
import type { BulletChange, FactGuardWarning } from '@/types/tailor'

export interface ReceiptInput {
  changes: Pick<BulletChange, 'status'>[]
  keywords: { presentBefore: string[]; presentAfter: string[] }
  coverageBefore: number | null
  warnings: FactGuardWarning[]
}

/** One claim the fact guard took out. */
export interface LeftOutClaim {
  key: string
  kind: FactGuardWarning['type']
  /** What the rewrite tried to say. */
  claim: string
  /** The plain-language follow-up shown under the struck claim. */
  question: string
  /**
   * Set when the claim came from a role or project bullet the master still has: "Add it"
   * can send the user's real number through the evidence interview for that bullet.
   */
  evidence: { section: 'roles' | 'projects'; entryId: string; bullet: string } | null
}

export interface Receipt {
  kept: number
  /** Job keywords the tailored resume covers that the master didn't. Null for results saved before coverage was recorded. */
  keywordsAdded: number | null
  keywordsAddedList: string[]
  leftOut: LeftOutClaim[]
  /** Entries the model dropped that the fact guard put back. */
  restored: number
  /**
   * Always 0, by design: anything not supported by the resume (or the user's own
   * evidence answers) is reverted or removed by the fact guard before a result is saved.
   */
  invented: 0
}

export const REAL_NUMBER_QUESTION = "It isn't in your resume. If it's true, what's the real number?"

function question(w: FactGuardWarning): string {
  switch (w.type) {
    case 'new_number':
      return REAL_NUMBER_QUESTION
    case 'skill_dropped':
      return "These aren't in your resume. If you have them, add them to your resume and tailor again."
    case 'entry_discarded':
      return "This isn't in your resume, so we didn't add it."
    case 'fact_restored':
      return w.restored ? `Your resume says "${w.restored}", so we kept that.` : 'Your resume says otherwise, so we kept what it says.'
    default:
      return ''
  }
}

/** Fact-guard warnings that took a claim out (everything except putting a dropped entry back). */
export function isLeftOut(w: FactGuardWarning): boolean {
  return w.type !== 'entry_restored' && !!w.attempted?.trim()
}

/** Keywords the tailored resume covers that the master didn't; null when the master's coverage wasn't recorded. */
export function newlyCoveredKeywords(input: Pick<ReceiptInput, 'keywords' | 'coverageBefore'>): string[] | null {
  const { presentBefore, presentAfter } = input.keywords
  // Older results didn't store what the master covered; don't count everything as new.
  const knowsBefore = presentBefore.length > 0 || input.coverageBefore === 0
  if (!knowsBefore) return null
  return presentAfter.filter((k) => !presentBefore.includes(k))
}

export function buildReceipt(input: ReceiptInput): Receipt {
  const added = newlyCoveredKeywords(input)
  const leftOut = input.warnings.filter(isLeftOut).map((w, i): LeftOutClaim => {
    const canAsk = w.type === 'new_number' && (w.section === 'roles' || w.section === 'projects') && !!w.id && !!w.restored?.trim()
    return {
      key: `${i}:${w.type}:${w.id ?? w.section}`,
      kind: w.type,
      claim: w.attempted!.trim(),
      question: question(w),
      evidence: canAsk ? { section: w.section as 'roles' | 'projects', entryId: w.id!, bullet: w.restored!.trim() } : null,
    }
  })
  return {
    kept: input.changes.filter((c) => c.status === 'accepted').length,
    keywordsAdded: added === null ? null : added.length,
    keywordsAddedList: added ?? [],
    leftOut,
    restored: input.warnings.filter((w) => w.type === 'entry_restored').length,
    invented: 0,
  }
}
