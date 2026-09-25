// Shared by the evidence interview routes: auth, ownership, the Pro gate, rate limit.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAccess } from '@/lib/entitlements'
import { canUseEvidenceInterview, PRICING } from '@/lib/plans'
import { checkRateLimit, rateLimitResponseBody } from '@/lib/rate-limit'
import { track } from '@/lib/track'

export async function evidenceContext(resumeId: string, { rateLimit = false } = {}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const
  }
  const userId = session.user.id
  const resume = await prisma.resume.findFirst({ where: { id: resumeId, userId, isActive: true } })
  if (!resume) {
    return { error: NextResponse.json({ error: 'Resume not found' }, { status: 404 }) } as const
  }
  const access = await getAccess(userId)
  if (!canUseEvidenceInterview(access.isPro)) {
    await track('limit_hit', { kind: 'evidence' }, userId)
    return {
      error: NextResponse.json(
        {
          error: `The evidence interview is a Pro feature. It asks for your real numbers and rewrites your weakest bullets with them. ${PRICING.monthly.display} or ${PRICING.pass.display}.`,
          upgradeRequired: true,
        },
        { status: 402 }
      ),
    } as const
  }
  if (rateLimit) {
    const rate = checkRateLimit(`evidence:${userId}`)
    if (!rate.allowed) {
      return {
        error: NextResponse.json(rateLimitResponseBody(rate.retryAfterSeconds), {
          status: 429,
          headers: { 'Retry-After': String(rate.retryAfterSeconds) },
        }),
      } as const
    }
  }
  return { userId, resume } as const
}
