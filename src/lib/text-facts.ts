// Fact checks for free-form prose (cover letters, evidence rewrites). Pure, no AI.
//
// The tailor guard (fact-guard.ts) can compare structured fields; prose can't be, so this
// looks for the things a model invents: numbers, and names (employers, tools, credentials)
// that don't appear in the allowed source text. Names are spotted by shape: acronyms
// (AWS, PMP), tech-looking tokens (Node.js, C#, EC2, JavaScript), and capitalized words
// that don't start a sentence (Kubernetes, Google). It's strict on purpose: a false alarm
// costs one regenerate or one dropped sentence, a miss puts a lie on someone's letter.
import { containsTerm, extractNumbers, extractNumberTokens } from '@/lib/resume-text'

// Capitalized words that are never facts on their own.
const STOP_TERMS = new Set(
  [
    'i', "i'm", "i've", "i'd", "i'll", 'dear', 'hello', 'hi', 'hiring', 'manager', 'managers', 'team', 'teams', 'recruiter', 'recruiting',
    'committee', 'sincerely', 'regards', 'best', 'kind', 'warm', 'warmly', 'thank', 'thanks', 'respectfully', 'cheers', 'yours', 'truly',
    'mr', 'ms', 'mrs', 'mx', 'dr', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october',
    'november', 'december', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'english', 'ai',
  ].map((s) => s.toLowerCase())
)

// Spelled-out numbers worth checking. "one"/"two" are left out: too idiomatic ("one of").
const WORD_NUMBERS: Record<string, number> = {
  three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100,
  hundreds: 100, thousand: 1000, thousands: 1000, million: 1e6, millions: 1e6, billion: 1e9, dozens: 12,
}

export interface UnsupportedFacts {
  numbers: string[] // as written
  terms: string[] // names/tools/credentials/employers not in the source
}

/** Sentences, keeping their punctuation. A period only ends one when whitespace and a
 * capital follow, so "Node.js" and "3.5" stay whole. Line breaks always split. */
export function splitSentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?]["”)]?)\s+(?=["“(]?[A-Z0-9])/))
    .map((s) => s.trim())
    .filter(Boolean)
}

const stripToken = (t: string) =>
  t
    .replace(/^[^A-Za-z0-9.#+]+/, '')
    .replace(/[’']s$/i, '')
    .replace(/[^A-Za-z0-9#+]+$/, '')

function looksLikeName(token: string, sentenceStart: boolean): boolean {
  if (!/[A-Za-z]/.test(token)) return false
  if (/^[A-Z]{2,}[0-9]*s?$/.test(token)) return true // AWS, SQL, PMP, CPAs
  if (/[a-z][A-Z]/.test(token) || /^[a-z]+[A-Z]/.test(token)) return true // JavaScript, iOS
  if (/[A-Za-z][0-9]|[0-9][A-Za-z]/.test(token) && !/^\d+(k|m|b|bn|mm|x|s|th|st|nd|rd)$/i.test(token)) return true // EC2, Web3
  if (/[.#+]/.test(token.slice(1)) || /^\.[A-Za-z]/.test(token)) return true // Node.js, C#, C++, .NET
  return !sentenceStart && /^[A-Z][a-z]/.test(token)
}

/** Name-like terms in `text` (deduped, as written). */
export function nameTerms(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const sentence of splitSentences(text)) {
    const tokens = sentence.split(/\s+/)
    tokens.forEach((raw, i) => {
      const token = stripToken(raw)
      if (!token || STOP_TERMS.has(token.toLowerCase())) return
      if (!looksLikeName(token, i === 0)) return
      const key = token.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        out.push(token)
      }
    })
  }
  return out
}

function termAllowed(term: string, allowedText: string): boolean {
  if (containsTerm(allowedText, term)) return true
  // "Next.js-based", "Stripe-powered": check the parts.
  const parts = term.split(/[-/]/).filter((p) => p.length > 1)
  if (parts.length > 1) return parts.every((p) => STOP_TERMS.has(p.toLowerCase()) || !/^[A-Z]/.test(p) || containsTerm(allowedText, p))
  return false
}

/** Spelled-out numbers ("five engineers") with their numeric token. */
function wordNumbers(text: string): { raw: string; token: string }[] {
  const out: { raw: string; token: string }[] = []
  for (const match of text.toLowerCase().matchAll(/\b[a-z]+\b/g)) {
    const value = WORD_NUMBERS[match[0]]
    if (value !== undefined) out.push({ raw: match[0], token: String(value) })
  }
  return out
}

/**
 * Numbers and names in `text` that aren't supported by `allowedText`. A spelled-out
 * number is fine if the source has the word or the digits.
 */
export function unsupportedFacts(text: string, allowedText: string): UnsupportedFacts {
  const allowedNumbers = new Set(extractNumberTokens(allowedText))
  for (const n of wordNumbers(allowedText)) allowedNumbers.add(n.token)
  const numbers = [
    ...extractNumbers(text).filter((n) => !allowedNumbers.has(n.token)),
    ...wordNumbers(text).filter((n) => !allowedNumbers.has(n.token) && !containsTerm(allowedText, n.raw)),
  ].map((n) => n.raw)
  const terms = nameTerms(text).filter((t) => !termAllowed(t, allowedText))
  return { numbers: [...new Set(numbers)], terms }
}

export function hasUnsupported(f: UnsupportedFacts): boolean {
  return f.numbers.length + f.terms.length > 0
}

/** Drop the sentences that carry unsupported facts. Returns what's left and what went. */
export function dropUnsupportedSentences(text: string, allowedText: string): { text: string; removed: { sentence: string; facts: UnsupportedFacts }[] } {
  const kept: string[] = []
  const removed: { sentence: string; facts: UnsupportedFacts }[] = []
  for (const sentence of splitSentences(text)) {
    const facts = unsupportedFacts(sentence, allowedText)
    if (hasUnsupported(facts)) removed.push({ sentence, facts })
    else kept.push(sentence)
  }
  return { text: kept.join(' '), removed }
}

export function describeFacts(f: UnsupportedFacts): string {
  return [...f.numbers, ...f.terms].join(', ')
}
