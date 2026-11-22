// Partner codes at sign-up (rules in src/lib/partner-rules.ts). Fails soft: nothing here
// may break sign-up.
import { prisma } from '@/lib/prisma'
import { currentChainEnd, refreshPlanMirror } from '@/lib/entitlements'
import { passWindow } from '@/lib/entitlement-rules'
import { track } from '@/lib/track'
import { PARTNERS, partnerBlock, partnerFor, type Partner } from '@/lib/partner-rules'

/** A brand-new user came in on a partner's ?ref= link: give them the partner's Pro days. Returns the days given. */
export async function grantPartnerDays(userId: string, ref: string | null | undefined, now = new Date(), list: Record<string, Partner> = PARTNERS): Promise<number> {
  const partner = partnerFor(ref, list)
  if (!partner) return 0
  try {
    const claimed = await prisma.event.count({ where: { name: 'partner_joined', props: { path: ['code'], equals: partner.code } } })
    const blocked = partnerBlock(partner, claimed, now)
    if (blocked) {
      await track('partner_joined', { code: partner.code, days: 0, blocked }, userId)
      return 0
    }
    // Stack after any comp or pass they already have (a new account has none, but be safe).
    const [comp, pass] = await Promise.all([currentChainEnd(userId, 'COMP', now), currentChainEnd(userId, 'STRIPE_PASS', now)])
    const after = [comp, pass].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null
    const window = passWindow(now, after, partner.days)
    await prisma.entitlement.create({ data: { userId, source: 'COMP', status: 'ACTIVE', startsAt: window.startsAt, endsAt: window.endsAt } })
    await refreshPlanMirror(userId)
    await track('partner_joined', { code: partner.code, days: partner.days }, userId)
    return partner.days
  } catch (error) {
    console.error('[partners] grant skipped:', (error as Error)?.message)
    return 0
  }
}
