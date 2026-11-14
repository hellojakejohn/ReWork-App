// Keyword coverage: how a resume's text covers the JD's target keywords. Plain string
// matching, no AI. Each keyword is one of:
// - present: the job's own words, as an ATS would search for them. A plural counts
//   ("knowledge bases"), "ERC-20/721/1155" counts as each standard, and "Postman / curl"
//   counts if either is there. The score is the weighted share of these: keywords come
//   most important first, the first counts 1 and the last 0.5 (keywordWeight).
// - related: shown in other words. Word forms ("Front-End" = "front end" = "frontends",
//   "Unit Testing" = "unit tests", "web and mobile applications" for "Web Applications"),
//   the same words in another order or form within one line ("processed vendor invoices"
//   for "Invoice Processing"), the thing right after a verb of running it ("ran weekly
//   inventory" for "Inventory Management") and a short list of honest implications
//   (PostgreSQL shows SQL). True, so the tailor may use the job's wording for them, which
//   moves them to present.
// - missing: not shown at all. Only the user's own answers can add these.
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

// Small words, and the generic ones job posts tack on ("administrative experience",
// "Excel skills"): the rest of the keyword is what has to show.
const FILLER = new Set(['and', 'or', 'of', 'the', 'a', 'an', 'to', 'for', 'in', 'on', 'with', 'at', 'by', 'experience', 'skills', 'skill', 'knowledge', 'proficiency', 'background'])

// Irregular past forms resumes use, read as the plain verb ("Wrote the guide" shows Writing).
const IRREGULAR: Record<string, string> = {
  wrote: 'write', written: 'write', taught: 'teach', built: 'build', led: 'lead', ran: 'run', drove: 'drive',
  sold: 'sell', bought: 'buy', spoke: 'speak', made: 'make', grew: 'grow', gave: 'give', kept: 'keep',
  met: 'meet', sent: 'send', spent: 'spend', began: 'begin', chose: 'choose', won: 'win', oversaw: 'oversee',
}

/**
 * Looser than stem(), only for "in other words": processing/processed, management/managed,
 * coordination/coordinated, documentation/documented all share a root. Short results fall
 * back to stem() so "nation" never reads as "n".
 */
export function root(word: string): string {
  const s = stem(IRREGULAR[word.toLowerCase()] ?? word)
  if (s.length < 5) return s
  let r = s.replace(/(?:ations?|ions?)$/, '')
  // management -> manage, but document stays document
  if (r === s && /ments?$/.test(s) && s.replace(/ments?$/, '').length >= 5) r = s.replace(/ments?$/, '')
  if (r.length > 4) r = r.replace(/e$/, '')
  if (r.length > 5) r = r.replace(/at$/, '')
  return r.length >= 4 ? r : s
}

const DATE_LINE = /^(?:present|current|now|today|ongoing|\d{1,2}[/-]\d{4}|\d{4}(?:[/-]\d{1,2})?|[a-z]{3,9}\.? \d{4})$/i

/** A resume's lines (bullets, sentences) as root lists: words only count together inside one. */
function rootLines(text: string): string[][] {
  return text
    .split(/\n|[.;!?](?:\s|$)/)
    // An end date ("Present", "2021-06") is not a skill: "present" must never show "Presentations".
    .filter((line) => !DATE_LINE.test(line.trim()))
    .map((line) => wordsOf(line).map(root))
    .filter((line) => line.length > 0)
}

function contentRoots(keyword: string): string[] {
  return wordsOf(keyword).filter((w) => !FILLER.has(w)).map(root)
}

/** Every root in `want` inside one window of `size` words of `line`. */
function inWindow(line: string[], want: string[], size: number): boolean {
  for (let i = 0; i < line.length; i++) {
    const win = line.slice(i, i + size)
    if (want.every((r) => win.includes(r))) return true
  }
  return false
}

/**
 * The keyword's words in another order or form, in one line: "processed vendor invoices" for
 * "Invoice Processing", "scheduled staff" for "Staff Scheduling". At most 3 words between.
 */
function reorderedMatch(lines: string[][], keyword: string): boolean {
  const want = contentRoots(keyword)
  if (want.length === 0 || want.length > 4 || want.some((r) => r.length < 4)) return false
  return lines.some((line) => inWindow(line, want, want.length + 3))
}

// "Ran weekly inventory" shows "Inventory Management": the thing, right after a verb of
// running it. Only these endings, and only these verbs.
const MANAGING_NOUNS = new Set(['manag', 'administr', 'coordin', 'oversight'])
const MANAGING_VERBS = new Set(
  ['ran', 'run', 'running', 'managed', 'managing', 'led', 'leading', 'oversaw', 'overseeing', 'owned', 'handled', 'handling', 'coordinated', 'coordinating', 'directed', 'supervised', 'administered', 'organized', 'maintained'].map(root)
)

function managedMatch(lines: string[][], keyword: string): boolean {
  const want = contentRoots(keyword)
  if (want.length < 2 || !MANAGING_NOUNS.has(want[want.length - 1])) return false
  const thing = want.slice(0, -1)
  if (thing.some((r) => r.length < 4)) return false
  return lines.some((line) => line.some((w, i) => MANAGING_VERBS.has(w) && inWindow(line.slice(i + 1, i + 5), thing, 4)))
}

const SQL_DATABASES = ['PostgreSQL', 'Postgres', 'MySQL', 'SQLite', 'SQL Server', 'T-SQL', 'MSSQL', 'MariaDB', 'PL/SQL', 'Supabase']
const NOSQL_DATABASES = ['MongoDB', 'DynamoDB', 'Firestore', 'Cassandra', 'Redis', 'Couchbase']
const MS_OFFICE = ['Microsoft Office', 'MS Office', 'Microsoft 365', 'Office 365', 'M365']

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
  restful: ['REST', 'REST API', 'REST APIs'],
  restfulapi: ['REST API', 'REST APIs'],
  restapi: ['RESTful API', 'RESTful APIs'],
  // Microsoft Office is these programs, so listing it shows each one.
  word: MS_OFFICE,
  microsoftword: MS_OFFICE,
  excel: MS_OFFICE,
  microsoftexcel: MS_OFFICE,
  powerpoint: MS_OFFICE,
  microsoftpowerpoint: MS_OFFICE,
  outlook: MS_OFFICE,
  microsoftoutlook: MS_OFFICE,
}

/** The more specific names in `text` that show `keyword` ("PostgreSQL" for "SQL"). */
export function impliedBy(text: string, keyword: string): string[] {
  return (IMPLIED[squash(wordsOf(keyword))] ?? []).filter((term) => containsTerm(text, term))
}

const options = (keyword: string) => keyword.split(/\s+\/\s+/).filter(Boolean)

/** The job's own words (or a plural, family member or either-or option) are in `text`. */
export function hasExactKeyword(text: string, keyword: string): boolean {
  const expanded = expandFamilies(text)
  return options(keyword).some((option) => variants(option).some((v) => containsTerm(expanded, v)))
}

/** `text` shows `keyword`, in the job's words or in other words. */
export function hasKeyword(text: string, keyword: string): boolean {
  if (hasExactKeyword(text, keyword)) return true
  const words = wordsOf(text)
  if (options(keyword).some((option) => formMatch(words, option) || impliedBy(text, option).length > 0)) return true
  const lines = rootLines(text)
  return options(keyword).some((option) => reorderedMatch(lines, option) || managedMatch(lines, option))
}

/** Weight of the keyword at `index` of `count`: 1 for the first, down to 0.5 for the last. */
export function keywordWeight(index: number, count: number): number {
  return count <= 1 ? 1 : 1 - (0.5 * index) / (count - 1)
}

/** Weighted share (0-100) of `keywords` that are in `hits`. */
export function weightedScore(keywords: string[], hits: string[]): number {
  if (keywords.length === 0) return 0
  let total = 0
  let got = 0
  keywords.forEach((k, i) => {
    const w = keywordWeight(i, keywords.length)
    total += w
    if (hits.includes(k)) got += w
  })
  return Math.round((got / total) * 100)
}

export function keywordCoverage(keywords: string[], text: string): KeywordCoverage {
  const present: string[] = []
  const related: string[] = []
  const missing: string[] = []
  for (const keyword of keywords) {
    if (hasExactKeyword(text, keyword)) present.push(keyword)
    else if (hasKeyword(text, keyword)) related.push(keyword)
    else missing.push(keyword)
  }
  return { score: weightedScore(keywords, present), present, related, missing }
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
