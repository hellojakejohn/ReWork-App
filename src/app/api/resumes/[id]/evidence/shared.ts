// Shared by the evidence interview routes: auth, ownership, the Pro gate, rate limit,
// the daily ceiling (new interviews only) and the AI cap.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAccess } from '@/lib/entitlements'
import { canUseEvidenceInterview, GO_PRO_OFFERS } from '@/lib/plans'
import { checkRateLimit, rateLimitResponseBody } from '@/lib/rate-limit'
import { track } from '@/lib/track'
import { checkDailyCeiling } from '@/lib/daily-ceiling'
import { aiPausedCheck, getAIBudget } from '@/lib/ai-cap'

export async function evidenceContext(resumeId: string, { rateLimit = false, dailyCeiling = false, ai: needsAI = false } = {}) {
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
          error: `The evidence interview is a Pro feature. It asks for your real numbers and rewrites your weakest bullets with them. ${GO_PRO_OFFERS}.`,
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
  if (dailyCeiling) {
    const ceiling = await checkDailyCeiling(userId, 'evidence')
    if (!ceiling.allowed) {
      await track('limit_hit', { kind: 'daily_evidence' }, userId)
      return { error: NextResponse.json({ success: false, error: ceiling.message }, { status: 429 }) } as const
    }
  }
  // Applying accepted rewrites is editing, not AI: it keeps working while AI is paused.
  if (!needsAI) return { userId, resume, ai: null } as const
  const ai = await getAIBudget(userId)
  const paused = await aiPausedCheck(ai, userId, 'evidence')
  if (paused) return { error: NextResponse.json(paused, { status: 429 }) } as const
  return { userId, resume, ai } as const
}
