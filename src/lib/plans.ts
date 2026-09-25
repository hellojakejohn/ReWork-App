// Single source of truth for plan limits and pricing copy.
// Safe to import from client components (no server-only imports).

export type PlanName = 'FREE' | 'PREMIUM'

// Tailoring is the expensive call (OpenAI), so it's the metered thing.
export const FREE_TAILORS_PER_MONTH = 3
// Uploads are unlimited, but FREE accounts can only keep this many master resumes
// at once so nobody uses uploads as a free parsing API.
export const FREE_MAX_MASTER_RESUMES = 5

export const PRO_PRICE_DISPLAY = '$3/month'

export const PLAN_LIMITS: Record<PlanName, { tailorsPerMonth: number; masterResumes: number }> = {
  FREE: { tailorsPerMonth: FREE_TAILORS_PER_MONTH, masterResumes: FREE_MAX_MASTER_RESUMES },
  PREMIUM: { tailorsPerMonth: Infinity, masterResumes: Infinity },
}

export function tailorLimitFor(plan: PlanName | null | undefined): number {
  return PLAN_LIMITS[plan === 'PREMIUM' ? 'PREMIUM' : 'FREE'].tailorsPerMonth
}

export function masterResumeLimitFor(plan: PlanName | null | undefined): number {
  return PLAN_LIMITS[plan === 'PREMIUM' ? 'PREMIUM' : 'FREE'].masterResumes
}

// Copy used across landing page, settings, status bar, FAQ.
export const FREE_PLAN_SUMMARY = `${FREE_TAILORS_PER_MONTH} tailored resumes per month, unlimited uploads and downloads`
export const PRO_PLAN_SUMMARY = `Unlimited tailored resumes for ${PRO_PRICE_DISPLAY}`
