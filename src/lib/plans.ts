// Single source of truth for plan limits and pricing copy.
// Safe to import from client components (no server-only imports).

// Tailoring is the expensive call (OpenAI), so it's the metered thing.
export const FREE_TAILORS_PER_MONTH = 3
// Cover letters are one model call each, cheaper than a tailor. FREE gets one to try.
export const FREE_COVER_LETTERS_PER_MONTH = 1
// The tracker shows and manages this many applications on FREE (newest first).
export const FREE_TRACKER_APPLICATIONS = 10
// Uploads are unlimited, but FREE accounts can only keep this many master resumes
// at once so nobody uses uploads as a free parsing API.
export const FREE_MAX_MASTER_RESUMES = 5

// Per-user daily ceilings for everyone, Pro included. Pro is "unlimited" for a person
// applying to jobs; these only stop scripts from running up the OpenAI bill. Counted per
// UTC day from the events table (src/lib/daily-ceiling.ts).
export const DAILY_CEILINGS = {
  tailor: 40,
  coverLetter: 40,
  parse: 60,
} as const
export type DailyCeilingKind = keyof typeof DAILY_CEILINGS

const DAILY_NOUN: Record<DailyCeilingKind, string> = {
  tailor: 'tailored resumes',
  coverLetter: 'cover letters',
  parse: 'resume uploads',
}

export function dailyCeilingMessage(kind: DailyCeilingKind): string {
  return `You've reached today's limit of ${DAILY_CEILINGS[kind]} ${DAILY_NOUN[kind]}. It resets at midnight UTC. If you really need more today, email ${CONTACT_EMAIL}.`
}

// Hard input caps. Checked on the server; the client checks the same numbers first so
// people get the message before an upload.
export const INPUT_LIMITS = {
  resumeFileBytes: 5 * 1024 * 1024,
  resumeTextChars: 30_000,
  jobDescriptionChars: 20_000,
} as const

export const INPUT_LIMIT_MESSAGES = {
  resumeFile: 'That file is over 5 MB. Try exporting a smaller PDF, or paste your resume text instead.',
  resumeText: 'That text is over 30,000 characters, which is longer than any resume. Paste just your resume.',
  jobDescription: 'That job description is over 20,000 characters. Paste just the role, responsibilities and requirements.',
} as const

export const CONTACT_EMAIL = 'hellojakejohn@gmail.com'

// Days of Pro a Job Hunt Pass buys. Buying another while one is active stacks.
export const PASS_DAYS = 30

export type OfferId = 'monthly' | 'pass'

export interface Offer {
  id: OfferId
  name: string
  amount: string // "$9"
  period: string // "/month" or "one-time"
  display: string // "$9/month"
  cadence: string // short phrase for fine print
  priceEnv: 'STRIPE_PRICE_PRO_MONTHLY' | 'STRIPE_PRICE_PASS_30D'
  mode: 'subscription' | 'payment'
  blurb: string
}

export const PRICING: Record<OfferId, Offer> = {
  monthly: {
    id: 'monthly',
    name: 'Pro Monthly',
    amount: '$9',
    period: '/month',
    display: '$9/month',
    cadence: 'Auto-renews monthly. Cancel anytime.',
    priceEnv: 'STRIPE_PRICE_PRO_MONTHLY',
    mode: 'subscription',
    blurb: 'Best if you apply steadily over a few months.',
  },
  pass: {
    id: 'pass',
    name: 'Job Hunt Pass',
    amount: '$15',
    period: 'one-time',
    display: `$15 for ${PASS_DAYS} days`,
    cadence: `${PASS_DAYS} days of Pro. No auto-renew.`,
    priceEnv: 'STRIPE_PRICE_PASS_30D',
    mode: 'payment',
    blurb: 'One sprint of applications. Pay once, nothing to cancel.',
  },
}

export const OFFER_IDS: OfferId[] = ['monthly', 'pass']

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
  'Unlimited tailored resumes',
  'Unlimited cover letters, fact-checked like your resume',
  'Evidence interview: stronger bullets from your real numbers',
  'Unlimited application tracker',
  'PDF + Word downloads (Word for application portals)',
]

export const FREE_FEATURES = [
  `${FREE_TAILORS_PER_MONTH} tailored resumes per month`,
  `${FREE_COVER_LETTERS_PER_MONTH} cover letter per month`,
  `Application tracker for up to ${FREE_TRACKER_APPLICATIONS} jobs`,
  'PDF downloads',
]

// Copy used across landing page, settings, status bar, FAQ.
export const FREE_PLAN_SUMMARY = `${FREE_TAILORS_PER_MONTH} tailored resumes and ${FREE_COVER_LETTERS_PER_MONTH} cover letter per month, a tracker for up to ${FREE_TRACKER_APPLICATIONS} jobs, PDF downloads`
export const PRO_PLAN_SUMMARY = `Unlimited tailoring, cover letters and tracking, plus the evidence interview and Word downloads, for ${PRICING.monthly.display}, or ${PRICING.pass.amount} for a ${PASS_DAYS}-day Job Hunt Pass`
