// Pay from the job post: the salary or hourly range the ad names, as one short label
// ("$120k to $150k a year"). No AI, client-safe. Null when the ad names no clear pay.
// Funding rounds, bonuses and revenue ("raised $50M", "$5,000 signing bonus") don't count.

export type PayPeriod = 'hour' | 'week' | 'month' | 'year'

export interface Pay {
  min: number
  max: number
  currency: string // "$", "£", "€"
  period: PayPeriod | null
  label: string
}

const NUM = String.raw`(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)`
const CUR = String.raw`(?:([$£€])|\b(USD|CAD|AUD|EUR|GBP)\s?)`
const PERIOD = String.raw`(?:\s*(?:/|per|an?|each)\s*|\s+)(hour|hr|year|yr|annum|annually|month|mo|week|wk)\b`
// One amount, an optional "k", then optionally "- / to" a second amount, then the period.
const PAY_RE = new RegExp(
  String.raw`${CUR}\s?${NUM}\s?([kK])?(?![\w])(?:\s*(?:-|–|—|to)\s*(?:[$£€]|USD|CAD|AUD|EUR|GBP)?\s?${NUM}\s?([kK])?(?![\w]))?(?:\s*(?:USD|CAD|AUD|EUR|GBP))?(?:${PERIOD})?`,
  'g'
)
// A range of bare "k" numbers with no currency: "120k-150k".
const BARE_K_RE = new RegExp(String.raw`\b(\d{2,3})\s?[kK]\s*(?:-|–|—|to)\s*(\d{2,3})\s?[kK]\b(?:${PERIOD})?`, 'g')

const NOT_PAY_AFTER = /^\s*(?:\+\s*)?(?:m\b|mm\b|b\b|bn\b|million|billion|in (?:funding|revenue|sales|arr)|signing|sign-on|bonus|relocation|stipend|budget|of (?:funding|revenue))/i
// "$100/month education budget", "$500 home office stipend": a perk a few words on.
// Only the amount's own noun: "$100/month education budget", "$500 home office stipend". Not
// "$150,000 plus annual bonus": there the perk is an extra on top of a real salary.
const NOT_PAY_SOON = /^(?:[ \t]*\/[ \t]*(?:mo|month|year|yr|week|wk))?(?:[ \t]+[a-z-]+){0,2}[ \t]+(?:budget|stipend|allowance|reimbursement|credit|perk)s?\b/i
const NOT_PAY_BEFORE = /(raised|funding|funded|revenue|valuation|valued|series [a-e]|bonus|stipend|budget|reimburse\w*|allowance|credit|401k|match)[^.\n]{0,30}$/i
const PAY_WORD_BEFORE = /(salary|pay|compensation|wage|rate|range|base|earn|ote|annual|hourly|per year|per hour)[^.\n]{0,50}$/i

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', CAD: '$', AUD: '$', EUR: '€', GBP: '£' }

function amount(raw: string, k: string | undefined): number {
  const n = Number(raw.replace(/,/g, ''))
  return k ? n * 1000 : n
}

function periodOf(word: string | undefined): PayPeriod | null {
  if (!word) return null
  const w = word.toLowerCase()
  if (w === 'hour' || w === 'hr') return 'hour'
  if (w === 'week' || w === 'wk') return 'week'
  if (w === 'month' || w === 'mo') return 'month'
  return 'year'
}

/** A period the numbers make obvious when the ad doesn't say: $25 is hourly, $95,000 yearly. */
function inferPeriod(max: number): PayPeriod | null {
  if (max >= 15 && max <= 300) return 'hour'
  if (max >= 20000) return 'year'
  return null
}

function money(n: number, currency: string, period: PayPeriod | null): string {
  if (n >= 1000 && period !== 'hour') {
    const k = n / 1000
    return `${currency}${Number.isInteger(k) ? k : Number(k.toFixed(1))}k`
  }
  return `${currency}${Number.isInteger(n) ? n.toLocaleString('en-US') : n.toFixed(2)}`
}

const PER: Record<PayPeriod, string> = { hour: 'an hour', week: 'a week', month: 'a month', year: 'a year' }

export function payLabel(pay: Omit<Pay, 'label'>): string {
  const range = pay.min === pay.max ? money(pay.min, pay.currency, pay.period) : `${money(pay.min, pay.currency, pay.period)} to ${money(pay.max, pay.currency, pay.period)}`
  return pay.period ? `${range} ${PER[pay.period]}` : range
}

interface Candidate {
  pay: Omit<Pay, 'label'>
  explicit: boolean // the ad said the period, or a pay word comes right before it
}

function accept(text: string, index: number, end: number, min: number, max: number, currency: string, periodWord: string | undefined): Candidate | null {
  const before = text.slice(Math.max(0, index - 60), index)
  const after = text.slice(end, end + 30)
  if (NOT_PAY_AFTER.test(after) || NOT_PAY_BEFORE.test(before) || NOT_PAY_SOON.test(text.slice(end, end + 40))) return null
  if (max < min) [min, max] = [max, min]
  if (min < 7 || max > 2_000_000 || max > min * 4) return null
  const said = periodOf(periodWord)
  const period = said ?? inferPeriod(max)
  if (!period) return null
  // A lone yearly figure under $20k or an hourly one over $300 is almost never pay.
  if (period === 'year' && max < 15000) return null
  if (period === 'hour' && max > 500) return null
  // A monthly figure under $1,000 is a perk or a fee, not a salary.
  if (period === 'month' && max < 1000) return null
  return { pay: { min, max, currency, period }, explicit: !!said || PAY_WORD_BEFORE.test(before) || min !== max }
}

export function payFromText(text: string | null | undefined): Pay | null {
  if (!text) return null
  const found: Candidate[] = []
  for (const m of text.matchAll(PAY_RE)) {
    const [whole, sym, code, a, ak, b, bk, periodWord] = m
    const currency = sym ?? CURRENCY_SYMBOL[code ?? ''] ?? '$'
    // "120 - 150k": the k on the second number applies to both.
    const min = amount(a, ak ?? (b && bk && !a.includes(',') && Number(a) < 1000 ? bk : undefined))
    const max = b ? amount(b, bk ?? (ak && !b.includes(',') && Number(b) < 1000 ? ak : undefined)) : min
    const c = accept(text, m.index!, m.index! + whole.length, min, max, currency, periodWord)
    if (c) found.push(c)
  }
  for (const m of text.matchAll(BARE_K_RE)) {
    const c = accept(text, m.index!, m.index! + m[0].length, Number(m[1]) * 1000, Number(m[2]) * 1000, '$', m[3])
    if (c) found.push(c)
  }
  // Prefer a range or a figure the ad clearly calls pay; otherwise the first plausible one.
  const best = found.find((c) => c.explicit) ?? null
  if (!best) return null
  return { ...best.pay, label: payLabel(best.pay) }
}
