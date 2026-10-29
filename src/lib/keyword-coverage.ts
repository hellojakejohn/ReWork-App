// Keyword coverage: share of the JD's target keywords that appear in a resume's text.
// Plain string matching, no AI. A little looser than the fact guard's containsTerm: a
// plural counts ("knowledge bases"), "ERC-20/721/1155" counts as each standard, and
// "Postman / curl" counts if either is there.
import type { KeywordCoverage, TailorInput, TailorOutput } from '@/types/tailor'
import { containsTerm, tailorInputText, tailorOutputText } from '@/lib/resume-text'

/** "ERC-20/721/1155" -> "ERC-20/721/1155 ERC-20 ERC-721 ERC-1155". */
function expandFamilies(text: string): string {
  return text.replace(/\b([A-Za-z]+-)(\d+)((?:\/\d+)+)/g, (all, prefix: string, first: string, rest: string) =>
    [all, ...[first, ...rest.split('/').filter(Boolean)].map((n) => prefix + n)].join(' ')
  )
}

function variants(term: string): string[] {
  const t = term.trim()
  if (t.length <= 3 || /[^A-Za-z]$/.test(t)) return [t]
  return /s$/i.test(t) ? [t, t.slice(0, -1)] : [t, `${t}s`]
}

export function hasKeyword(text: string, keyword: string): boolean {
  const options = keyword.split(/\s+\/\s+/).filter(Boolean)
  return options.some((option) => variants(option).some((v) => containsTerm(text, v)))
}

export function keywordCoverage(keywords: string[], text: string): KeywordCoverage {
  const present: string[] = []
  const missing: string[] = []
  const expanded = expandFamilies(text)
  for (const keyword of keywords) {
    if (hasKeyword(expanded, keyword)) present.push(keyword)
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
