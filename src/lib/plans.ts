// Single source of truth for plan limits and pricing copy.
// Safe to import from client components (no server-only imports).

// Tailoring is the expensive call, so it's the metered thing.
export const FREE_TAILORS_PER_MONTH = 3
// Cover letters are one model call each, cheaper than a tailor. FREE gets one to try.
export const FREE_COVER_LETTERS_PER_MONTH = 1
// The tracker shows and manages this many applications on FREE (newest first).
export const FREE_TRACKER_APPLICATIONS = 10
// Uploads are unlimited, but FREE accounts can only keep this many master resumes
// at once so nobody uses uploads as a free parsing API.
export const FREE_MAX_MASTER_RESUMES = 5

// Per-user daily ceilings for everyone, Pro included. An abuse guard, not a plan limit:
// a real job search doesn't come close. The money guard is the AI cap
// (src/lib/ai-cap-rules.ts). Counted per UTC day from the events table
// (src/lib/daily-ceiling.ts).
export const DAILY_CEILINGS = {
  tailor: 20,
  coverLetter: 20,
  parse: 10,
  evidence: 10,
} as const
export type DailyCeilingKind = keyof typeof DAILY_CEILINGS

const DAILY_NOUN: Record<DailyCeilingKind, string> = {
  tailor: 'tailored resumes',
  coverLetter: 'cover letters',
  parse: 'resume uploads',
  evidence: 'evidence interviews',
}

export function dailyCeilingMessage(kind: DailyCeilingKind): string {
  return `You've reached today's limit of ${DAILY_CEILINGS[kind]} ${DAILY_NOUN[kind]}. It resets at midnight UTC. If you really need more today, email ${CONTACT_EMAIL}.`
}

// Hard input caps. Checked on the server; the client checks the same numbers first so
// people get the message before an upload. The file cap is 4 MB, not 5: Vercel rejects
// function request bodies over 4.5 MB before our code runs, with a non-JSON error.
export const INPUT_LIMITS = {
  resumeFileBytes: 4 * 1024 * 1024,
  resumeTextChars: 30_000,
  jobDescriptionChars: 20_000,
} as const

export const INPUT_LIMIT_MESSAGES = {
  resumeFile: 'That file is over 4 MB. Try exporting a smaller PDF, or paste your resume text instead.',
  resumeText: 'That text is over 30,000 characters, which is longer than any resume. Paste just your resume.',
  jobDescription: 'That job description is over 20,000 characters. Paste just the role, responsibilities and requirements.',
} as const

export const CONTACT_EMAIL = 'hellojakejohn@gmail.com'

// Days of Pro a Job Hunt Pass buys. Buying another while one is active stacks. The
// Stripe webhook (passWindow) and the pass-to-subscription trial both use this.
export const PASS_DAYS = 90

// Plain prices in USD. The AI cap is computed from these (src/lib/ai-cap-rules.ts), so a
// price change here moves the cap with it. Stripe price objects are created outside the
// code; the env vars below must point at prices that match these numbers.
export const PRO_MONTHLY_PRICE_USD = 15
export const PASS_PRICE_USD = 29

// AI cap for FREE accounts, in USD per calendar month (src/lib/ai-cap-rules.ts): a flat
// backstop, since FREE brings in no revenue. Revisit once npm run eval:models has run on
// real keys: it has to cover a parse, 3 tailors and 1 cover letter on AI_FREE_TIER.
export const FREE_AI_CAP_USD = 0.5

// Never say "unlimited". Pro is generous, not infinite.
export const FAIR_USE = 'Fair use: plenty for an active job search'

export type OfferId = 'monthly' | 'pass'

export interface Offer {
  id: OfferId
  name: string
  priceUsd: number
  amount: string // "$15"
  period: string // "/month" or "one-time"
  display: string // "$15/month"
  cadence: string // short phrase for fine print
  // Env var holding the Stripe price id; fallbackEnv is an older name still read.
  priceEnv: 'STRIPE_PRICE_PRO_MONTHLY' | 'STRIPE_PRICE_PASS'
  fallbackEnv?: 'STRIPE_PRICE_PASS_30D'
  mode: 'subscription' | 'payment'
  headline?: string
  blurb: string
}

export const PRICING: Record<OfferId, Offer> = {
  pass: {
    id: 'pass',
    name: 'Job Hunt Pass',
    priceUsd: PASS_PRICE_USD,
    amount: `$${PASS_PRICE_USD}`,
    period: 'one-time',
    display: `$${PASS_PRICE_USD} for 3 months`,
    cadence: `${PASS_DAYS} days of Pro. Never renews.`,
    priceEnv: 'STRIPE_PRICE_PASS',
    fallbackEnv: 'STRIPE_PRICE_PASS_30D',
    mode: 'payment',
    headline: '3 months of Pro. Pay once. Never renews.',
    blurb: `Cheaper than 2 months of Pro ($${PRO_MONTHLY_PRICE_USD * 2}). Nothing to cancel.`,
  },
  monthly: {
    id: 'monthly',
    name: 'Pro Monthly',
    priceUsd: PRO_MONTHLY_PRICE_USD,
    amount: `$${PRO_MONTHLY_PRICE_USD}`,
    period: '/month',
    display: `$${PRO_MONTHLY_PRICE_USD}/month`,
    cadence: 'Auto-renews monthly. Cancel anytime.',
    priceEnv: 'STRIPE_PRICE_PRO_MONTHLY',
    mode: 'subscription',
    blurb: 'Best if you apply steadily for longer than a few months.',
  },
}

// Headline offer first.
export const OFFER_IDS: OfferId[] = ['pass', 'monthly']

// Pricing copy "Powered by Claude Opus 5.5". Shown only when Pro routing really is that
// model (the server checks AI_TAILOR, src/lib/ai/routing.ts proRunsOnOpus()).
export const POWERED_BY = {
  enabled: true,
  model: 'claude-opus-5-5',
  copy: 'Powered by Claude Opus 5.5',
} as const

export function isOfferId(v: unknown): v is OfferId {
  return v === 'monthly' || v === 'pass'
}

export const PLAN_LIMITS = {
  free: {
    tailorsPerMonth: FREE_TAILORS_PER_MONTH,
    coverLettersPerMonth: FREE_COVER_LETTERS_PER_MONTH,
    masterResumes: FREE_MAX_MASTER_RESUMES,
    trackedApplications: FREE_TRACKER_APPLICATIONS,
    evidenceInterview: false,
    wordExport: false, // FREE downloads PDF only
  },
  pro: {
    tailorsPerMonth: Infinity,
    coverLettersPerMonth: Infinity,
    masterResumes: Infinity,
    trackedApplications: Infinity,
    evidenceInterview: true,
    wordExport: true,
  },
} as const

export function tailorLimitFor(isPro: boolean): number {
  return PLAN_LIMITS[isPro ? 'pro' : 'free'].tailorsPerMonth
}

export function coverLetterLimitFor(isPro: boolean): number {
  return PLAN_LIMITS[isPro ? 'pro' : 'free'].coverLettersPerMonth
}

export function trackerLimitFor(isPro: boolean): number {
  return PLAN_LIMITS[isPro ? 'pro' : 'free'].trackedApplications
}

export function canUseEvidenceInterview(isPro: boolean): boolean {
  return PLAN_LIMITS[isPro ? 'pro' : 'free'].evidenceInterview
}

export function canExportWord(isPro: boolean): boolean {
  return PLAN_LIMITS[isPro ? 'pro' : 'free'].wordExport
}

export const WORD_EXPORT_UPSELL = 'Word downloads are a Pro feature. Application portals read .docx best; PDF stays free.'

export function masterResumeLimitFor(isPro: boolean): number {
  return PLAN_LIMITS[isPro ? 'pro' : 'free'].masterResumes
}

// Only list what Pro actually does today. Landing, /pricing and the upgrade sheet read these.
export const PRO_FEATURES = [
  'A tailored resume for every job you apply to',
  'Cover letters, fact-checked like your resume',
  'Evidence interview: stronger bullets from your real numbers',
  'Track every application',
  'PDF + Word downloads (Word for application portals)',
  FAIR_USE,
]

export const FREE_FEATURES = [
  `${FREE_TAILORS_PER_MONTH} tailored resumes per month`,
  `${FREE_COVER_LETTERS_PER_MONTH} cover letter per month`,
  `Application tracker for up to ${FREE_TRACKER_APPLICATIONS} jobs`,
  'PDF downloads',
]

// Copy used across landing page, settings, status bar, FAQ.
export const FREE_PLAN_SUMMARY = `${FREE_TAILORS_PER_MONTH} tailored resumes and ${FREE_COVER_LETTERS_PER_MONTH} cover letter per month, a tracker for up to ${FREE_TRACKER_APPLICATIONS} jobs, PDF downloads`
export const PRO_PLAN_SUMMARY = `Tailoring, cover letters and tracking for your whole search (fair use), plus the evidence interview and Word downloads: ${PRICING.pass.amount} once for a 3-month Job Hunt Pass, or ${PRICING.monthly.display}`

// The two ways to pay, for limit messages ("Go Pro: ...").
export const GO_PRO_OFFERS = `${PRICING.pass.display}, never renews, or ${PRICING.monthly.display}`
