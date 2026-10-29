// Small, pure checks on a job: tidy its title and spot a description written for a
// different company (a job board reposting someone else's ad). Shared by the resolver and
// the Job card, so pasted jobs get the same checks as links.

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/** Same company, ignoring case, punctuation and suffixes ("Acme" vs "Acme, Inc."). */
export function sameCompany(a: string, b: string): boolean {
  const x = norm(a.replace(/\b(inc|llc|ltd|corp|co|gmbh|plc)\b\.?/gi, ''))
  const y = norm(b.replace(/\b(inc|llc|ltd|corp|co|gmbh|plc)\b\.?/gi, ''))
  if (!x || !y) return false
  return x === y || (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x)))
}

/** "Senior Designer - Acme" with company "Acme" -> "Senior Designer". Also "|", "at", "@". */
export function cleanJobTitle(title: string, company: string): string {
  const t = title.trim()
  if (!company.trim()) return t
  const m = t.match(/^(.+?)\s*(?:[-–—|·:@]|\bat\b)\s*([^-–—|·:@]+)$/i)
  if (m && m[1].trim().length >= 3 && sameCompany(m[2], company)) return m[1].trim()
  return t
}

// Phrases an ad uses to name its own company: "As a Designer at Coinglass", "About
// Coinglass", "Join Coinglass", "Coinglass is a ...", "at Coinglass, you".
const NAME = String.raw`([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,2})`
const SELF_NAMING = [
  new RegExp(String.raw`\b(?:[Aa]t|[Jj]oin|[Jj]oining|[Aa]bout)\s+${NAME}`, 'g'),
  new RegExp(String.raw`(?:^|[.\n]\s*)${NAME}\s+(?:is|was|builds|helps|provides|offers)\s+(?:a|an|the|one)\b`, 'g'),
]
const NOT_A_NAME = /^(the|our|this|us|you|we|a|an|least|all|scale|home|work|any|role|job|position|team|every|times?|first|last)$/i

/**
 * The company a description names itself as, when that is not `company` and it does so at
 * least twice. Null when it agrees, or when there is no clear signal.
 */
export function otherCompanyNamed(description: string, company: string): string | null {
  if (!company.trim() || !description.trim()) return null
  const counts = new Map<string, { name: string; n: number }>()
  for (const re of SELF_NAMING) {
    for (const m of description.matchAll(re)) {
      const name = m[1].trim().replace(/[.']+$/, '')
      if (NOT_A_NAME.test(name.split(/\s+/)[0])) continue
      if (sameCompany(name, company)) return null
      const key = norm(name)
      const c = counts.get(key) || { name, n: 0 }
      c.n += 1
      counts.set(key, c)
    }
  }
  // The other name should also show up as a plain word more than once overall.
  const best = [...counts.values()].sort((a, b) => b.n - a.n)[0]
  if (!best) return null
  const mentions = description.split(best.name).length - 1
  const companyMentions = description.toLowerCase().split(company.toLowerCase()).length - 1
  return best.n >= 2 && mentions >= 2 && companyMentions === 0 ? best.name : null
}

// Job-scam tells, checked on the ad text with no AI call. Each one is something real ads
// almost never do, so a match is worth a warning, never a verdict. Checked per sentence so
// "GitHub" in a skills list or "we pay for training" doesn't trip anything.
export type ScamSignalId = 'run_code' | 'chat_app' | 'pay_to_start' | 'wallet' | 'personal_info' | 'personal_email'

export interface ScamSignal {
  id: ScamSignalId
  /** What we noticed, in plain words. */
  label: string
  /** The bit of the ad that matched, trimmed. */
  quote: string
}

const SCAM_CHECKS: { id: ScamSignalId; label: string; test: (s: string) => boolean }[] = [
  {
    id: 'run_code',
    label: 'It asks you to download or run code as part of applying. Fake "take-home tests" are a common way to install malware that steals passwords and crypto.',
    test: (s) =>
      /\b(clone|download|run|install|execute|open|npm (?:i|install|start|run)|yarn)\b/i.test(s) &&
      /\b(repo|repository|github|gitlab|bitbucket|codebase|\.zip|project files?|the project|this project|our project)\b/i.test(s) &&
      /\b(test|assessment|task|challenge|take[- ]home|interview|assignment|exercise|evaluation|before (?:the|your|our) (?:call|meeting))\b/i.test(s),
  },
  {
    id: 'chat_app',
    label: 'It moves the conversation to a chat app. Real recruiters rarely interview over Telegram, WhatsApp or Signal.',
    test: (s) =>
      /\b(t\.me|wa\.me|chat\.whatsapp\.com)\/\S+/i.test(s) ||
      /\b(contact|message|reach|text|dm|add|interview|chat with|apply|write to|ping)\b[^.\n]{0,50}\b(telegram|whatsapp|signal|wechat|discord)\b/i.test(s) ||
      /\b(telegram|whatsapp|signal|wechat)\b[^.\n]{0,20}(@\w{4,}|\+\d[\d ()-]{6,})/i.test(s),
  },
  {
    id: 'pay_to_start',
    label: 'It asks you to pay something or handle a check. Real employers never charge you to start or ask you to deposit their checks.',
    test: (s) =>
      !/\b(no|never|free|without|zero|waived?)\b[^.\n]{0,25}\b(fees?|cost|deposit|charge)\b/i.test(s) &&
      (/\b(training|registration|onboarding|starter(?: kit)?|application|processing|equipment|enrollment|certification) (fee|deposit|cost|charge)s?\b/i.test(s) ||
        /\b(you will|you'll|you must|you need to|required to|need to|must first)\s+(pay|purchase|buy)\b/i.test(s) ||
        /\b(deposit|cash) (the|a|our) (check|cheque)\b/i.test(s) ||
        /\bsend you a (check|cheque)\b/i.test(s)),
  },
  {
    id: 'wallet',
    label: 'It mentions your wallet, seed phrase or sending crypto. No real job needs your wallet connected or your keys.',
    test: (s) =>
      /\bconnect (?:your |a )?(?:crypto |web3 )?wallet\b/i.test(s) ||
      /\byour (seed|recovery|secret) phrase\b/i.test(s) ||
      /\byour private keys?\b/i.test(s) ||
      /\b(send|transfer|deposit)\b[^.\n]{0,30}\b(usdt|usdc|btc|bitcoin|eth|ethereum|crypto)\b/i.test(s),
  },
  {
    id: 'personal_info',
    label: 'It asks for your SSN, bank details or ID up front. That belongs in real onboarding after an offer, never in an application.',
    test: (s) =>
      /\b(send|provide|submit|share|email|include|attach)\b[^.\n]{0,50}\b(ssn|social security(?: number)?|bank (?:account|details|info)|routing number|passport|driver'?s licen[cs]e|copy of your id|photo id)\b/i.test(s),
  },
  {
    id: 'personal_email',
    label: 'The contact is a personal email address (Gmail, Yahoo and so on). Fine for a small local business, unusual for a company.',
    test: (s) => /\b[\w.+-]+@(gmail|googlemail|yahoo|outlook|hotmail|live|proton|protonmail|icloud|aol)\.(com|me)\b/i.test(s),
  },
]

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Every scam tell in the ad, once each, in the order of SCAM_CHECKS. Empty when it looks normal. */
export function scamSignals(description: string): ScamSignal[] {
  const found: ScamSignal[] = []
  const parts = sentences(description)
  for (const check of SCAM_CHECKS) {
    const hit = parts.find(check.test)
    if (hit) found.push({ id: check.id, label: check.label, quote: hit.length > 160 ? `${hit.slice(0, 157)}...` : hit })
  }
  return found
}

export const SCAM_SAFETY_TIP =
  "Never run code, install apps, connect a wallet, pay a fee or send ID for a job you haven't checked. Find the role on the company's own careers page first."

// Ghost-job signs: facts about the posting that make it less likely someone is hiring for
// it right now (old, reposted, no pay, an agency, "future openings"). Never a verdict, no AI
// call. The text checks work on any ad; the rest need facts a resolver or the Save to
// ReWork reader found (posting date, applicant count, closing date, structured pay).
export interface JobFacts {
  /** When the ad went up: an ISO date, or the page's own words ("Reposted 2 weeks ago", "30+ days ago"). */
  posted?: string
  /** The board's own count, as shown ("Over 100 applicants"). */
  applicants?: string
  /** When applications close (ISO date), from schema.org validThrough. */
  closes?: string
  /** Pay is listed in a structured field, not only in the text. */
  pay?: boolean
}

/** An ISO date from a date string or epoch milliseconds; undefined when it isn't one. */
export function isoDate(v: unknown): string | undefined {
  const t = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Date.parse(v) : NaN
  return Number.isFinite(t) && t > Date.UTC(2000, 0, 1) ? new Date(t).toISOString() : undefined
}

/** Drops empty fields; undefined when nothing is left. */
export function compactFacts(facts: JobFacts): JobFacts | undefined {
  const out = Object.fromEntries(Object.entries(facts).filter(([, v]) => v !== undefined && v !== '' && v !== false)) as JobFacts
  return Object.keys(out).length ? out : undefined
}

export type GhostSignalId = 'closed' | 'old' | 'reposted' | 'pipeline' | 'agency' | 'applicants' | 'no_pay'

export interface GhostSignal {
  id: GhostSignalId
  label: string
}

const DAY_MS = 24 * 60 * 60 * 1000
const UNIT_DAYS: Record<string, number> = { minute: 0, hour: 0, day: 1, week: 7, month: 30, year: 365 }
// Ads older than this get the "old" sign. Most roles fill in about six weeks.
export const OLD_POSTING_DAYS = 30

/** Days since the ad went up, and whether that is a floor ("30+ days ago"). Null when unreadable. */
export function postedDaysAgo(posted: string | undefined, now = new Date()): { days: number; plus: boolean } | null {
  const text = (posted || '').trim()
  if (!text) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const at = Date.parse(text)
    if (Number.isNaN(at)) return null
    return { days: Math.max(0, Math.floor((now.getTime() - at) / DAY_MS)), plus: false }
  }
  if (/\b(just posted|today|just now|moments? ago)\b/i.test(text)) return { days: 0, plus: false }
  const m = text.match(/\b(\d+|an?)(\+)?\s+(minute|hour|day|week|month|year)s?\s+ago\b/i)
  if (!m) return null
  const n = /^an?$/i.test(m[1]) ? 1 : Number(m[1])
  return { days: n * UNIT_DAYS[m[3].toLowerCase()], plus: !!m[2] }
}

/** "Over 100 applicants" -> 100. Null when there is no count. */
export function applicantCount(text: string | undefined): number | null {
  const m = (text || '').replace(/,/g, '').match(/\b(\d+)\+?\s+(applicants|applications|people clicked apply)\b/i)
  return m ? Number(m[1]) : null
}

const PAY_PATTERNS = [
  /[$£€]\s?\d/,
  /\b(usd|eur|gbp|cad|aud)\s?\d/i,
  /\d\s?(usd|eur|gbp|cad|aud)\b/i,
  /\b\d{2,3}k\s?(-|–|to)\s?[$£€]?\d{2,3}k\b/i,
  /\b\d{1,3}(\.\d{2})?\s?(\/|per |an |a )\s?(hour|hr)\b/i,
  /\b(salary|pay|base pay|compensation|wage|hourly rate)\b[^.\n]{0,60}\b\d{2,3}(,\d{3}|\.\d{2}|k)\b/i,
]

/** The ad names a pay figure somewhere. */
export function mentionsPay(description: string): boolean {
  return PAY_PATTERNS.some((re) => re.test(description))
}

// Case matters for "our client" (no /i): "our Client Platform team" is a product, not an agency.
const AGENCY_CLIENT = /\b[Oo]ur client\b(?!\s+[A-Z])/
const AGENCY = /\b(on behalf of (?:our|a|the) client|confidential client|client of ours|(?:staffing|recruitment|recruiting) (?:agency|firm)|we are recruiting for|recruiting on behalf of)\b/i
// Only the wording of an ad for no current role. "Broadest talent pool" (EEO boilerplate),
// "a pipeline of accounts" (sales) and "evergreen campaigns" (marketing) are normal ads.
const PIPELINE = /\b(evergreen (?:role|position|requisition|req|posting|opening|job)|(?:join|joining) our talent (?:community|network|pool)|not (?:be )?immediately available|no (?:current|immediate) (?:openings?|vacanc(?:y|ies))|(?:building|build) (?:our|a) (?:talent )?pipeline of (?:\w+ )?(?:talent|candidates)|considered for future (?:openings|opportunities|roles|positions))/i

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function quoteOf(description: string, re: RegExp): string {
  const m = description.match(re)
  return m ? m[0] : ''
}

/** Every ghost-job sign for this ad, most telling first. Empty when nothing stands out. */
export function ghostSignals(description: string, facts: JobFacts = {}, now = new Date()): GhostSignal[] {
  const found: GhostSignal[] = []
  const closes = facts.closes ? Date.parse(facts.closes) : NaN
  if (!Number.isNaN(closes) && closes < now.getTime() - DAY_MS) {
    found.push({ id: 'closed', label: `The posting says applications closed on ${shortDate(facts.closes!)}.` })
  }
  const age = postedDaysAgo(facts.posted, now)
  if (age && age.days >= OLD_POSTING_DAYS) {
    // A board phrase keeps the board's words ("1 month ago"); a date becomes days or months.
    const phrase = (facts.posted || '').match(/\b(\d+\+?|an?)\s+(minute|hour|day|week|month|year)s?\s+ago\b/i)?.[0]
    const when = phrase ?? (age.days >= 60 ? `about ${Math.round(age.days / 30)} months ago` : `${age.days} days ago`)
    found.push({ id: 'old', label: `Posted ${when}. Older ads are more often filled, paused or left up by mistake.` })
  }
  if (/\breposted\b/i.test(facts.posted || '')) {
    found.push({ id: 'reposted', label: 'It has been reposted. Some roles get reposted for months without a hire.' })
  }
  const pipeline = quoteOf(description, PIPELINE)
  if (pipeline) {
    found.push({ id: 'pipeline', label: `It mentions "${pipeline.toLowerCase()}". There may be no open role right now, just a list of candidates.` })
  }
  const agency = quoteOf(description, AGENCY) || quoteOf(description, AGENCY_CLIENT)
  if (agency) {
    found.push({ id: 'agency', label: `It reads like a recruiting agency's ad ("${agency.toLowerCase()}"). The employer may not be named.` })
  }
  const applicants = applicantCount(facts.applicants)
  if (applicants !== null && applicants >= 100) {
    found.push({ id: 'applicants', label: `${facts.applicants!.trim()} so far. A referral or a note to the hiring team helps you stand out.` })
  }
  if (!facts.pay && description.trim().length >= 200 && !mentionsPay(description)) {
    found.push({ id: 'no_pay', label: "No pay listed. It's fair to ask for the range before you interview." })
  }
  return found
}
