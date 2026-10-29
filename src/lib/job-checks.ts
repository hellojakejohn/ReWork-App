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
