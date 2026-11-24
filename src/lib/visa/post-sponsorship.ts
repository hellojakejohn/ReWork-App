// What the job post itself says about visa sponsorship. Stronger than any employer's
// history: "unable to sponsor" in this post means this job. No model.

export type PostSponsorship = 'no' | 'yes' | null

const NO = [
  /\b(?:not|unable to|cannot|can ?not|won'?t|will not|do(?:es)? not|are not able to|is not able to)\s+(?:currently\s+|now or in the future\s+)?(?:offer|provide|support|sponsor)(?:ing)?\s+(?:any\s+)?(?:employment\s+|work\s+)?(?:visa|h-?1b|immigration|sponsorship)/i,
  /\b(?:visa|h-?1b|immigration|employment)\s+sponsorship\s+(?:is\s+)?(?:not|un)\s*available\b/i,
  /\bno\s+(?:visa|h-?1b|immigration)?\s*sponsorship\b/i,
  /\bwithout\s+(?:the\s+need\s+for\s+|requiring\s+)?(?:current\s+or\s+future\s+)?(?:visa\s+|employer\s+|employment\s+)?sponsorship\b/i,
  /\bsponsorship\s+(?:will not|cannot|won'?t)\s+be\s+(?:provided|offered|considered)\b/i,
  /\bnot\s+eligible\s+for\s+(?:visa\s+)?sponsorship\b/i,
]
const YES = [
  /\b(?:visa|h-?1b|immigration)\s+sponsorship\s+(?:is\s+)?(?:available|offered|provided|possible)\b/i,
  /\b(?:we|will|can|able to)\s+(?:offer|provide|support)?\s*(?:visa|h-?1b)\s+sponsorship\b/i,
  /\bwill\s+sponsor\b/i,
  /\bsponsorship\s+(?:is\s+)?available\b/i,
]

/** "no" when the post rules sponsorship out, "yes" when it offers it, else null. "No" wins. */
export function postSponsorship(text: string): PostSponsorship {
  if (!text) return null
  if (NO.some((re) => re.test(text))) return 'no'
  if (YES.some((re) => re.test(text))) return 'yes'
  return null
}
