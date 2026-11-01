// Keyword coverage: share of the JD's target keywords that appear in a resume's text.
// Plain string matching, no AI. A little looser than the fact guard's containsTerm:
// - a plural counts ("knowledge bases"), "ERC-20/721/1155" counts as each standard, and
//   "Postman / curl" counts if either is there
// - word forms: "Front-End" = "front end" = "frontends", "Unit Testing" = "unit tests"
// - "web and mobile applications" shows "Web Applications"
// - a short list of honest implications: PostgreSQL shows SQL, TypeScript shows JavaScript
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

/** Drops simple endings so tests, testing and tested all read "test". Short words stay. */
export function stem(word: string): string {
  let w = word.toLowerCase()
  if (w.length < 4) return w
  if (/ies$/.test(w)) return `${w.slice(0, -3)}y`
  if (/(?:ss|sh|ch|x)es$/.test(w)) return w.slice(0, -2)
  if (/[^s]s$/.test(w)) return w.slice(0, -1)
  const cut = w.match(/^(.{3,}?)(?:ing|ed)$/)
  if (cut) {
    w = cut[1]
    // running -> run, debugged -> debug
    if (/([b-df-hj-np-tv-z])\1$/.test(w) && !/(?:ll|ss|ff|zz)$/.test(w)) w = w.slice(0, -1)
  }
  return w
}

function wordsOf(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean)
}

/** Words glued and stemmed: "Front-End" and "frontends" both read "frontend". */
function squash(words: string[]): string {
  return words.map(stem).join('')
}

const CONNECTORS = new Set(['and', 'or'])

/** Word-form match: joined/split compounds, word endings, "X and Y Zs" for "X Zs". */
function formMatch(textWords: string[], keyword: string): boolean {
  const kw = wordsOf(keyword)
  if (kw.length === 0) return false
  const target = squash(kw)
  if (target.length < 3) return false
  const maxSpan = kw.length + 1
  for (let i = 0; i < textWords.length; i++) {
    let joined = ''
    for (let n = 1; n <= maxSpan && i + n <= textWords.length; n++) {
      joined += stem(textWords[i + n - 1])
      if (joined === target) return true
      if (joined.length >= target.length) break
    }
  }
  if (kw.length < 2) return false
  // "web and mobile applications" for "Web Applications": the keyword's first part, a gap
  // of up to 3 words with an "and"/"or", then the rest.
  for (let split = 1; split < kw.length; split++) {
    const head = squash(kw.slice(0, split))
    const tail = kw.slice(split)
    for (let i = 0; i + split <= textWords.length; i++) {
      if (squash(textWords.slice(i, i + split)) !== head) continue
      for (let gap = 2; gap <= 3; gap++) {
        const between = textWords.slice(i + split, i + split + gap)
        if (between.length < gap || !between.some((w) => CONNECTORS.has(w))) continue
        const rest = textWords.slice(i + split + gap, i + split + gap + tail.length)
        if (rest.length === tail.length && squash(rest) === squash(tail)) return true
      }
    }
  }
  return false
}

const SQL_DATABASES = ['PostgreSQL', 'Postgres', 'MySQL', 'SQLite', 'SQL Server', 'T-SQL', 'MSSQL', 'MariaDB', 'PL/SQL', 'Supabase']
const NOSQL_DATABASES = ['MongoDB', 'DynamoDB', 'Firestore', 'Cassandra', 'Redis', 'Couchbase']

/**
 * Keywords a resume shows through a more specific name. Only true implications: anyone
 * who lists PostgreSQL has used SQL and a relational database. Keys are squash() forms.
 */
const IMPLIED: Record<string, string[]> = {
  sql: SQL_DATABASES,
  relationaldatabase: SQL_DATABASES.filter((d) => d !== 'PL/SQL'),
  database: [...SQL_DATABASES, ...NOSQL_DATABASES],
  nosql: NOSQL_DATABASES,
  javascript: ['TypeScript', 'Node.js'],
  cloud: ['AWS', 'Amazon Web Services', 'GCP', 'Google Cloud', 'Azure'],
  cicd: ['GitHub Actions', 'GitLab CI', 'CircleCI', 'Jenkins'],
}

/** The more specific names in `text` that show `keyword` ("PostgreSQL" for "SQL"). */
export function impliedBy(text: string, keyword: string): string[] {
  return (IMPLIED[squash(wordsOf(keyword))] ?? []).filter((term) => containsTerm(text, term))
}

export function hasKeyword(text: string, keyword: string): boolean {
  const options = keyword.split(/\s+\/\s+/).filter(Boolean)
  if (options.some((option) => variants(option).some((v) => containsTerm(text, v)))) return true
  const words = wordsOf(text)
  return options.some((option) => formMatch(words, option) || impliedBy(text, option).length > 0)
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

/** The master as printed: what the fit check scores, without evidence notes (never printed). */
export function masterKeywordText(master: TailorInput): string {
  return tailorInputText({ ...master, evidence: undefined })
}

export function coverageReport(master: TailorInput, tailored: TailorOutput) {
  const keywords = tailored.targetKeywords
  return {
    master: keywordCoverage(keywords, masterKeywordText(master)),
    tailored: keywordCoverage(keywords, tailorOutputText(tailored, master)),
  }
}
