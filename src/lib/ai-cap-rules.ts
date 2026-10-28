// Never lose money on AI: each user's AI spend is capped at a share of what they paid us
// for the current period. Pure (no Prisma), so it's unit tested and safe to import anywhere.
//
//   cap = AI_CAP_RATIO (default 0.70) x net revenue for the period
//   net = price - Stripe's cut (2.9% + $0.30), from the prices in plans.ts
//
//   Pro Monthly  one cap per subscription period (~$9.99 at $15), resets with the period
//   Job Hunt Pass ONE cap for the whole 90-day window (~$19.50 at $29), not per 30 days
//   Comp          like Pro Monthly, per calendar month
//   FREE          flat backstop per calendar month (FREE_AI_CAP_USD in plans.ts, $0.50)
//
// Bands (users never see dollars, only a percent and a reset date):
//   under 75%    routing as configured (Pro = Opus)
//   75% to 100%  paid calls run on AI_FREE_TIER (Sonnet 5.5), with a small banner
//                (AI_PRO_ALWAYS_OPUS=true turns this step off)
//   100%         AI pauses until the reset date; downloads, tracker, editing still work
import { CONTACT_EMAIL, FREE_AI_CAP_USD, PASS_PRICE_USD, PRO_MONTHLY_PRICE_USD } from '@/lib/plans'
import { isLive, type EntitlementLike, type EntitlementSource } from '@/lib/entitlement-rules'

export const STRIPE_PERCENT = 0.029
export const STRIPE_FIXED_USD = 0.3
export const DEFAULT_CAP_RATIO = 0.7
export const FREE_CAP_USD = FREE_AI_CAP_USD
export const DOWNGRADE_AT = 0.75

export function aiCapRatio(raw = process.env.AI_CAP_RATIO): number {
  const n = Number(raw)
  return raw !== undefined && raw !== '' && Number.isFinite(n) && n > 0 && n <= 1 ? n : DEFAULT_CAP_RATIO
}

/** What we keep from a card payment after Stripe's fee. */
export function netRevenueUsd(priceUsd: number): number {
  return Math.round((priceUsd - (priceUsd * STRIPE_PERCENT + STRIPE_FIXED_USD)) * 100) / 100
}

export type CapPeriodKind = 'monthly' | 'pass' | 'comp' | 'free'

export interface CapPeriod {
  kind: CapPeriodKind
  start: Date
  resetAt: Date // when the cap resets (period end)
  netRevenueUsd: number // 0 for FREE
}

const startOfUtcMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
const startOfNextUtcMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))

/** One calendar month before `d` (Stripe monthly periods are calendar months). */
export function oneMonthBefore(d: Date): Date {
  const out = new Date(d.getTime())
  const day = out.getUTCDate()
  out.setUTCDate(1)
  out.setUTCMonth(out.getUTCMonth() - 1)
  const lastDay = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate()
  out.setUTCDate(Math.min(day, lastDay))
  return out
}

type Row = EntitlementLike & { source: EntitlementSource }

/**
 * The period the cap applies to right now. A subscription in its current paid period wins
 * (its period started at most a month before its end); then a live pass window; then a
 * comp; else FREE. A subscription still in a pass-to-subscription trial isn't paid yet, so
 * the pass covers it.
 */
export function capPeriod(rows: Row[], now: Date): CapPeriod {
  const live = rows.filter((r) => isLive(r, now))

  const sub = live.find((r) => r.source === 'STRIPE_SUBSCRIPTION' && r.endsAt)
  if (sub?.endsAt) {
    const start = oneMonthBefore(sub.endsAt)
    if (start.getTime() <= now.getTime() && sub.startsAt.getTime() <= now.getTime()) {
      return { kind: 'monthly', start: start < sub.startsAt ? sub.startsAt : start, resetAt: sub.endsAt, netRevenueUsd: netRevenueUsd(PRO_MONTHLY_PRICE_USD) }
    }
  }

  // Each pass row is its own 90-day window (stacked passes are back to back).
  const pass = live
    .filter((r) => r.source === 'STRIPE_PASS' && r.endsAt)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0]
  if (pass?.endsAt) {
    return { kind: 'pass', start: pass.startsAt, resetAt: pass.endsAt, netRevenueUsd: netRevenueUsd(PASS_PRICE_USD) }
  }

  if (sub || live.length > 0) {
    // Comp (or an open-ended row): Pro Monthly's cap, per calendar month.
    return { kind: 'comp', start: startOfUtcMonth(now), resetAt: startOfNextUtcMonth(now), netRevenueUsd: netRevenueUsd(PRO_MONTHLY_PRICE_USD) }
  }
  return { kind: 'free', start: startOfUtcMonth(now), resetAt: startOfNextUtcMonth(now), netRevenueUsd: 0 }
}

/** The cap in USD: the admin override if set, else ratio x net (FREE: the flat backstop). */
export function capUsd(period: CapPeriod, ratio = aiCapRatio(), overrideUsd?: number | null): number {
  if (overrideUsd !== null && overrideUsd !== undefined && Number.isFinite(overrideUsd) && overrideUsd >= 0) return overrideUsd
  if (period.kind === 'free') return FREE_CAP_USD
  return Math.round(ratio * period.netRevenueUsd * 100) / 100
}

export type CapBand = 'normal' | 'downgrade' | 'paused'

export function bandFor(fraction: number): CapBand {
  if (fraction >= 1) return 'paused'
  if (fraction >= DOWNGRADE_AT) return 'downgrade'
  return 'normal'
}

export interface CapState {
  period: CapPeriod
  capUsd: number
  spentUsd: number
  fraction: number // spent / cap (Infinity when the cap is 0 and something was spent)
  percent: number // 0-100, for the UI
  band: CapBand
  isPaid: boolean
  // Paid user in the 75% band and a lighter model is configured (and not AI_PRO_ALWAYS_OPUS).
  downgraded: boolean
}

export function capState(opts: {
  period: CapPeriod
  spentUsd: number
  ratio?: number
  overrideUsd?: number | null
  proAlwaysTopModel?: boolean
  downgradeAvailable?: boolean
}): CapState {
  const cap = capUsd(opts.period, opts.ratio, opts.overrideUsd)
  const fraction = cap > 0 ? opts.spentUsd / cap : opts.spentUsd > 0 ? Infinity : 0
  const band = bandFor(fraction)
  const isPaid = opts.period.kind !== 'free'
  return {
    period: opts.period,
    capUsd: cap,
    spentUsd: opts.spentUsd,
    fraction,
    percent: Math.min(100, Math.round((Number.isFinite(fraction) ? fraction : 1) * 100)),
    band,
    isPaid,
    downgraded: isPaid && band === 'downgrade' && !opts.proAlwaysTopModel && !!opts.downgradeAvailable,
  }
}

/** Bands newly reached by spending `addedUsd` on top of `before` (for the 75% / 100% events). */
export function crossedBands(before: CapState, addedUsd: number): CapBand[] {
  if (addedUsd <= 0 || before.capUsd <= 0) return []
  const prev = before.fraction
  const next = (before.spentUsd + addedUsd) / before.capUsd
  const out: CapBand[] = []
  if (prev < DOWNGRADE_AT && next >= DOWNGRADE_AT) out.push('downgrade')
  if (prev < 1 && next >= 1) out.push('paused')
  return out
}

export function formatResetDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function pausedMessage(resetAt: Date): string {
  return `You've used this period's AI allowance, so AI features are paused until ${formatResetDate(resetAt)}. Downloads, the tracker and editing still work. If you need more before then, email ${CONTACT_EMAIL}.`
}

export function downgradeBanner(modelLabel: string, resetAt: Date): string {
  return `High usage this month: running on ${modelLabel} until ${formatResetDate(resetAt)}.`
}
