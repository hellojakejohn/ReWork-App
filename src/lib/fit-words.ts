// Tailor words for a fit score, shared by the public fit check (/fit), the Tailor card's fit
// check and share cards. Client-safe, no imports.

export type FitVerdict = 'tailored' | 'close' | 'alterations' | 'rework'

export function verdictFor(score: number): FitVerdict {
  if (score >= 70) return 'tailored'
  if (score >= 50) return 'close'
  if (score >= 30) return 'alterations'
  return 'rework'
}

export const VERDICT_WORDS: Record<FitVerdict, { title: string; body: string }> = {
  tailored: { title: 'Fits like it was made for you.', body: "Your resume already speaks this job's language. A tailor sharpens it." },
  close: { title: "Close. A few tucks and it's ready.", body: 'Most of what they want is there. Tailoring puts it in their words.' },
  alterations: { title: 'Needs alterations.', body: 'You have more than this shows. Tailoring leads with what matches.' },
  rework: { title: 'This one needs a real rework.', body: "Check the list below: if you have these skills, your resume isn't saying so yet." },
}

/** The three piles, named the same everywhere. */
export const PILES = {
  present: { title: 'Fits', hint: 'In your resume, in their words.' },
  related: { title: 'Fits, in other words', hint: 'You have it, said differently. A tailor uses their words.' },
  missing: { title: 'Needs alterations', hint: "Not in your resume. We never add these for you, but if you have them, tell us." },
} as const
