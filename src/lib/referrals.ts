// Referrals, server side. Every function fails soft: until the referrals SQL is pasted
// (prisma/migrations/20261122000000_referrals) the tables are missing, and nothing here
// may break sign-up or a tailor. Rules live in src/lib/referral-rules.ts.
import { prisma } from '@/lib/prisma'
import { currentChainEnd, refreshPlanMirror } from '@/lib/entitlements'
import { passWindow } from '@/lib/entitlement-rules'
import { track } from '@/lib/track'
import { REFERRAL_DAYS, cleanInviteCode, newInviteCode, referrerEligible, startOfUtcMonth } from '@/lib/referral-rules'

export interface ReferralStatus {
  code: string
  joined: number
  rewarded: number
  /** Days of Pro this user has earned from friends. */
  daysEarned: number
  /** This user joined through a link and hasn't finished a tailor yet. */
  pendingForMe: boolean
}

/** The user's invite code, made on first ask. Null if the tables aren't there yet. */
export async function ensureInviteCode(userId: string): Promise<string | null> {
  try {
    const existing = await prisma.referralCode.findUnique({ where: { userId }, select: { code: true } })
    if (existing) return existing.code
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const row = await prisma.referralCode.create({ data: { userId, code: newInviteCode() }, select: { code: true } })
        return row.code
      } catch (error) {
        // A code collision (or a parallel request that just made this user's code): look again.
        const again = await prisma.referralCode.findUnique({ where: { userId }, select: { code: true } })
        if (again) return again.code
        if ((error as { code?: string })?.code !== 'P2002') throw error
      }
    }
    return null
  } catch (error) {
    console.error('[referrals] code unavailable:', (error as Error)?.message)
    return null
  }
}

export async function referralStatus(userId: string): Promise<ReferralStatus | null> {
  const code = await ensureInviteCode(userId)
  if (!code) return null
  try {
    const [joined, rewardedRows, mine] = await Promise.all([
      prisma.referral.count({ where: { referrerId: userId } }),
      prisma.referral.count({ where: { referrerId: userId, rewardedAt: { not: null }, referrerRewarded: true } }),
      prisma.referral.findUnique({ where: { referredId: userId }, select: { rewardedAt: true } }),
    ])
    const friendDays = mine?.rewardedAt ? REFERRAL_DAYS : 0
    return {
      code,
      joined,
      rewarded: rewardedRows,
      daysEarned: rewardedRows * REFERRAL_DAYS + friendDays,
      pendingForMe: !!mine && !mine.rewardedAt,
    }
  } catch (error) {
    console.error('[referrals] status unavailable:', (error as Error)?.message)
    return null
  }
}

/**
 * Pro days on top of what the user already has: they start when the user's comps and
 * passes run out (a referral during a 90-day pass isn't swallowed by it).
 */
async function grantReferralDays(userId: string, now: Date): Promise<void> {
  const [comp, pass] = await Promise.all([currentChainEnd(userId, 'COMP', now), currentChainEnd(userId, 'STRIPE_PASS', now)])
  const after = [comp, pass].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null
  const window = passWindow(now, after, REFERRAL_DAYS)
  await prisma.entitlement.create({
    data: { userId, source: 'COMP', status: 'ACTIVE', startsAt: window.startsAt, endsAt: window.endsAt },
  })
  await refreshPlanMirror(userId)
}

/** At sign-up: record who invited this brand-new user. */
export async function linkReferral(newUserId: string, rawCode: string | null | undefined): Promise<void> {
  const code = cleanInviteCode(rawCode)
  if (!code) return
  try {
    const owner = await prisma.referralCode.findUnique({ where: { code }, select: { userId: true } })
    if (!owner || owner.userId === newUserId) return
    await prisma.referral.create({ data: { referrerId: owner.userId, referredId: newUserId } })
    await track('referral_joined', {}, newUserId)
  } catch (error) {
    console.error('[referrals] link skipped:', (error as Error)?.message)
  }
}

/**
 * After a user's tailor is saved: if they joined through a link and haven't been rewarded,
 * give them (and, under the monthly cap, the friend who invited them) REFERRAL_DAYS of Pro.
 * Returns the days this user just got, or 0.
 */
export async function rewardReferral(userId: string, now = new Date()): Promise<number> {
  try {
    const referral = await prisma.referral.findUnique({ where: { referredId: userId }, select: { id: true, referrerId: true, rewardedAt: true } })
    if (!referral || referral.rewardedAt) return 0
    const rewardedThisMonth = await prisma.referral.count({
      where: { referrerId: referral.referrerId, referrerRewarded: true, rewardedAt: { gte: startOfUtcMonth(now) } },
    })
    const referrerGets = referrerEligible(rewardedThisMonth)
    // Claim it once: a second tailor running at the same time finds rewardedAt set.
    const claimed = await prisma.referral.updateMany({
      where: { id: referral.id, rewardedAt: null },
      data: { rewardedAt: now, referrerRewarded: referrerGets },
    })
    if (claimed.count !== 1) return 0
    await grantReferralDays(userId, now)
    if (referrerGets) await grantReferralDays(referral.referrerId, now)
    await track('referral_rewarded', { days: REFERRAL_DAYS, referrerRewarded: referrerGets }, userId)
    return REFERRAL_DAYS
  } catch (error) {
    console.error('[referrals] reward skipped:', (error as Error)?.message)
    return 0
  }
}
