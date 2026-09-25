// Server-side entitlement access. The ONLY place that decides "is this user Pro".
//
// Every way of paying for Pro writes Entitlement rows; nothing else needs to change.
// A future crypto path (TOKEN_HOLD: holding a token, TOKEN_PAYMENT: paying in one) would
// add a verifier that upserts rows with those sources and calls refreshPlanMirror().
// Feature code only ever calls getAccess() / reads session.user.access.

import { prisma } from '@/lib/prisma'
import {
  DAY_MS,
  PAST_DUE_GRACE_DAYS,
  isLive,
  passWindow,
  summarizeAccess,
  type Access,
  type EntitlementSource,
} from '@/lib/entitlement-rules'

export type { Access } from '@/lib/entitlement-rules'

export async function getAccess(userId: string, now = new Date()): Promise<Access> {
  const rows = await prisma.entitlement.findMany({
    where: { userId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
    select: { source: true, status: true, startsAt: true, endsAt: true, cancelAtPeriodEnd: true, pastDueAt: true },
  })
  return summarizeAccess(rows, now)
}

/** Keeps User.plan in sync as a cached mirror for the admin page. Nothing else reads it. */
export async function refreshPlanMirror(userId: string): Promise<Access> {
  const access = await getAccess(userId)
  await prisma.user.update({
    where: { id: userId },
    data: { plan: access.isPro ? 'PREMIUM' : 'FREE' },
  })
  return access
}

/** Latest end among a user's still-active rows of one source (for stacking passes/comps). */
export async function currentChainEnd(userId: string, source: EntitlementSource, now = new Date()): Promise<Date | null> {
  const latest = await prisma.entitlement.findFirst({
    where: { userId, source, status: 'ACTIVE', endsAt: { gt: now } },
    orderBy: { endsAt: 'desc' },
    select: { endsAt: true },
  })
  return latest?.endsAt ?? null
}

/** Admin: comp N days of Pro. Stacks onto an existing comp. */
export async function grantComp(userId: string, days: number): Promise<Access> {
  const now = new Date()
  const window = passWindow(now, await currentChainEnd(userId, 'COMP', now), days)
  await prisma.entitlement.create({
    data: { userId, source: 'COMP', status: 'ACTIVE', startsAt: window.startsAt, endsAt: window.endsAt },
  })
  return refreshPlanMirror(userId)
}

/** Cron: flip rows whose time ran out to EXPIRED, then refresh the affected users' mirrors. */
export async function expireEntitlements(now = new Date()): Promise<{ expired: number; users: number }> {
  const graceCutoff = new Date(now.getTime() - PAST_DUE_GRACE_DAYS * DAY_MS)
  const candidates = await prisma.entitlement.findMany({
    where: {
      status: { in: ['ACTIVE', 'PAST_DUE'] },
      OR: [{ endsAt: { lte: now } }, { pastDueAt: { lte: graceCutoff } }],
    },
  })
  const dead = candidates.filter((r) => !isLive(r, now))
  // Time ran out -> EXPIRED. A PAST_DUE row past its grace stays PAST_DUE (Stripe may still
  // collect and flip it back to ACTIVE); it just stops granting Pro.
  const toExpire = dead.filter((r) => r.endsAt && r.endsAt <= now).map((r) => r.id)
  if (toExpire.length) {
    await prisma.entitlement.updateMany({ where: { id: { in: toExpire } }, data: { status: 'EXPIRED' } })
  }
  const userIds = [...new Set(dead.map((r) => r.userId))]
  for (const id of userIds) await refreshPlanMirror(id)
  return { expired: toExpire.length, users: userIds.length }
}
