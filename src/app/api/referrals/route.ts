// GET -> the signed-in user's invite link and how many friends joined and earned Pro.
// { available: false } until the referrals SQL is pasted (src/lib/referrals.ts fails soft).
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { referralStatus } from '@/lib/referrals'
import { REFERRAL_DAYS, REFERRER_MONTHLY_CAP, inviteLink } from '@/lib/referral-rules'
import { SITE_URL } from '@/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const status = await referralStatus(session.user.id)
  if (!status) return NextResponse.json({ available: false })
  return NextResponse.json({
    available: true,
    link: inviteLink(SITE_URL, status.code),
    joined: status.joined,
    rewarded: status.rewarded,
    daysEarned: status.daysEarned,
    pendingForMe: status.pendingForMe,
    days: REFERRAL_DAYS,
    monthlyCap: REFERRER_MONTHLY_CAP,
  })
}
