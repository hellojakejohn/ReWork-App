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
  },
  pro: {
    tailorsPerMonth: Infinity,
    coverLettersPerMonth: Infinity,
    masterResumes: Infinity,
    trackedApplications: Infinity,
    evidenceInterview: true,
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

export function masterResumeLimitFor(isPro: boolean): number {
  return PLAN_LIMITS[isPro ? 'pro' : 'free'].masterResumes
}

// Only list what Pro actually does today.
export const PRO_FEATURES = [
  'Unlimited tailored resumes',
  'Fact-checked rewrites (no invented numbers or titles)',
  'Keyword coverage report for every job',
  'Tailored PDF per job',
  // TODO(next session): add new Pro features here as they ship.
]

export const FREE_FEATURES = [
  `${FREE_TAILORS_PER_MONTH} tailored resumes per month`,
  `Up to ${FREE_MAX_MASTER_RESUMES} master resumes`,
  'Unlimited downloads',
]

// Copy used across landing page, settings, status bar, FAQ.
export const FREE_PLAN_SUMMARY = `${FREE_TAILORS_PER_MONTH} tailored resumes per month, up to ${FREE_MAX_MASTER_RESUMES} master resumes, unlimited downloads`
export const PRO_PLAN_SUMMARY = `Unlimited tailored resumes for ${PRICING.monthly.display}, or ${PRICING.pass.amount} for a ${PASS_DAYS}-day Job Hunt Pass`
