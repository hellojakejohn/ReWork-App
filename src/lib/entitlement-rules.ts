// Pure entitlement logic: no Prisma, no Stripe client. Safe for client imports and unit tests.
// Mirrors the Prisma enums as string unions so client bundles don't pull in @prisma/client.

import { PASS_DAYS } from '@/lib/plans'

export type EntitlementSource =
  | 'STRIPE_SUBSCRIPTION'
  | 'STRIPE_PASS'
  | 'COMP'
  | 'TOKEN_HOLD' // reserved
  | 'TOKEN_PAYMENT' // reserved

export type EntitlementStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED' | 'REFUNDED'

export const DAY_MS = 24 * 60 * 60 * 1000
export const PAST_DUE_GRACE_DAYS = 3
// A renewing subscription's period end passes a little before Stripe's renewal webhook
// lands. Don't drop Pro in that window.
export const RENEWAL_SLACK_MS = DAY_MS

export interface EntitlementLike {
  source: EntitlementSource
  status: EntitlementStatus
  startsAt: Date
  endsAt: Date | null
  cancelAtPeriodEnd: boolean
  pastDueAt: Date | null
}

// Serializable (goes through the NextAuth session and JSON responses).
export interface Access {
  isPro: boolean
  source: EntitlementSource | null
  endsAt: string | null // ISO; null = open-ended (or not Pro)
  cancelAtPeriodEnd: boolean
  daysLeft: number | null // null when open-ended or not Pro
  pastDue: boolean
}

export const NO_ACCESS: Access = {
  isPro: false,
  source: null,
  endsAt: null,
  cancelAtPeriodEnd: false,
  daysLeft: null,
  pastDue: false,
}

/** Maps a Stripe subscription status to ours. Returns null for states that grant nothing yet (incomplete). */
export function mapStripeSubscriptionStatus(status: string): EntitlementStatus | null {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'ACTIVE'
    case 'past_due':
    case 'unpaid':
      return 'PAST_DUE'
    case 'canceled':
    case 'incomplete_expired':
      return 'CANCELED'
    default:
      // 'incomplete' (first payment pending) and 'paused'
      return null
  }
}

/** Does this row grant Pro right now? */
export function isLive(e: EntitlementLike, now: Date): boolean {
  if (e.startsAt.getTime() > now.getTime()) return false
  const slack = e.source === 'STRIPE_SUBSCRIPTION' && !e.cancelAtPeriodEnd ? RENEWAL_SLACK_MS : 0
  if (e.endsAt && e.endsAt.getTime() + slack <= now.getTime()) return false
  if (e.status === 'ACTIVE') return true
  if (e.status === 'PAST_DUE') {
    // Grace starts when the payment failed; if we never saw the transition, allow the grace from now.
    const since = e.pastDueAt ?? now
    return now.getTime() < since.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS
  }
  return false
}

/**
 * Window for a newly bought pass. Stacks onto the end of the current pass if one is
 * still running, otherwise starts now.
 */
export function passWindow(now: Date, currentPassEnd: Date | null, days = PASS_DAYS): { startsAt: Date; endsAt: Date } {
  const start = currentPassEnd && currentPassEnd.getTime() > now.getTime() ? currentPassEnd : now
  return { startsAt: new Date(start.getTime()), endsAt: new Date(start.getTime() + days * DAY_MS) }
}

export interface PassRow {
  id: string
  startsAt: Date
  endsAt: Date
  createdAt: Date
}

/**
 * After a pass is refunded, later passes that were stacked behind it slide back to close
 * the gap. Each keeps its own length and never starts before it was bought.
 * `remaining` = still-active passes; returns their new windows in chain order.
 */
export function restackPasses(remaining: PassRow[], chainStart: Date): PassRow[] {
  const sorted = [...remaining].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  let cursor = chainStart.getTime()
  return sorted.map((row) => {
    const length = row.endsAt.getTime() - row.startsAt.getTime()
    const start = Math.max(cursor, row.createdAt.getTime())
    cursor = start + length
    return { ...row, startsAt: new Date(start), endsAt: new Date(start + length) }
  })
}

const SOURCE_PRIORITY: Record<EntitlementSource, number> = {
  STRIPE_SUBSCRIPTION: 0,
  STRIPE_PASS: 1,
  COMP: 2,
  TOKEN_PAYMENT: 3,
  TOKEN_HOLD: 4,
}

/**
 * Collapses a user's entitlement rows into one Access answer. Any live row makes the user Pro.
 * The row shown to the user is the subscription if there is one, else whichever source runs longest.
 * Pass rows are chained, so a pass's end is the end of the whole chain.
 */
export function summarizeAccess(rows: EntitlementLike[], now: Date): Access {
  const live = rows.filter((r) => isLive(r, now))
  if (live.length === 0) return NO_ACCESS

  // Effective end per source: stacked passes/comps extend each other.
  const endBySource = new Map<EntitlementSource, number>()
  for (const r of rows) {
    if (r.status !== 'ACTIVE' && !(r.status === 'PAST_DUE' && isLive(r, now))) continue
    const end = r.endsAt ? r.endsAt.getTime() : Infinity
    if (r.endsAt && end <= now.getTime()) continue
    endBySource.set(r.source, Math.max(endBySource.get(r.source) ?? 0, end))
  }

  const primary = [...live].sort((a, b) => {
    if (a.source === 'STRIPE_SUBSCRIPTION' || b.source === 'STRIPE_SUBSCRIPTION') {
      return SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source]
    }
    const diff = (endBySource.get(b.source) ?? 0) - (endBySource.get(a.source) ?? 0)
    return diff !== 0 ? diff : SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source]
  })[0]

  const end = endBySource.get(primary.source) ?? (primary.endsAt ? primary.endsAt.getTime() : Infinity)
  const endsAt = Number.isFinite(end) ? new Date(end) : null

  return {
    isPro: true,
    source: primary.source,
    endsAt: endsAt ? endsAt.toISOString() : null,
    cancelAtPeriodEnd: primary.source === 'STRIPE_SUBSCRIPTION' ? primary.cancelAtPeriodEnd : false,
    daysLeft: endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS)) : null,
    pastDue: primary.status === 'PAST_DUE',
  }
}

/** One line for the UI: "Pro via monthly, renews Oct 25" etc. */
export function describeAccess(access: Access): string {
  if (!access.isPro) return 'Free plan'
  const date = access.endsAt
    ? new Date(access.endsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null
  const days = access.daysLeft === 1 ? '1 day' : `${access.daysLeft} days`
  switch (access.source) {
    case 'STRIPE_SUBSCRIPTION':
      if (access.pastDue) return 'Pro via monthly, payment failed. Update your card to keep Pro.'
      if (access.cancelAtPeriodEnd) return date ? `Pro until ${date} (canceled)` : 'Pro (canceled)'
      return date ? `Pro via monthly, renews ${date}` : 'Pro via monthly'
    case 'STRIPE_PASS':
      return `Job Hunt Pass, ${days} left`
    case 'COMP':
      return date ? `Pro (complimentary) until ${date}` : 'Pro (complimentary)'
    default:
      return date ? `Pro until ${date}` : 'Pro'
  }
}
