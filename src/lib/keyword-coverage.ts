// Keyword coverage: share of the JD's target keywords that appear in a resume's text.
// Plain string matching, no AI.
import type { KeywordCoverage, TailorInput, TailorOutput } from '@/types/tailor'
import { containsTerm, tailorInputText, tailorOutputText } from '@/lib/resume-text'

export function keywordCoverage(keywords: string[], text: string): KeywordCoverage {
  const present: string[] = []
  const missing: string[] = []
  for (const keyword of keywords) {
    if (containsTerm(text, keyword)) present.push(keyword)
    else missing.push(keyword)
  }
  const score = keywords.length === 0 ? 0 : Math.round((present.length / keywords.length) * 100)
  return { score, present, missing }
}

export function coverageReport(master: TailorInput, tailored: TailorOutput) {
  const keywords = tailored.targetKeywords
  return {
    master: keywordCoverage(keywords, tailorInputText(master)),
    tailored: keywordCoverage(keywords, tailorOutputText(tailored, master)),
  }
}
