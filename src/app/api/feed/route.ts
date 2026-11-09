// Matches on upload (docs/job-feed-plan.md).
// GET  ?resumeId=           -> { prefs, matches, total, limit, isPro, matchedAt }
// POST { resumeId, targetTitles?, workplace? } -> saves the answer, finds matches, same body
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, rateLimitResponseBody } from '@/lib/rate-limit'
import { listMatches, loadPrefs, matchForResume, matchLimit, readPrefs, savePrefs } from '@/lib/feed/feed-server'
import { searchTitles } from '@/lib/feed/match'
import { masterToParsed } from '@/lib/master-resume'

export const runtime = 'nodejs'
export const maxDuration = 300

async function context(resumeId: unknown) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const
  if (typeof resumeId !== 'string' || !resumeId) return { error: NextResponse.json({ error: 'resumeId is required' }, { status: 400 }) } as const
  const userId = session.user.id
  const resume = await prisma.resume.findFirst({ where: { id: resumeId, userId, isActive: true } })
  if (!resume) return { error: NextResponse.json({ error: 'Resume not found' }, { status: 404 }) } as const
  return { userId, resume } as const
}

async function body(userId: string, resume: Awaited<ReturnType<typeof prisma.resume.findFirst>> & object) {
  const [saved, { isPro, limit }] = await Promise.all([loadPrefs(resume.id), matchLimit(userId)])
  const { matches, total } = await listMatches(prisma, userId, resume.id, limit)
  // Never asked yet: suggest their latest title, so one tap confirms it.
  const suggested = searchTitles(masterToParsed(resume), { targetTitles: [], workplace: 'both' })
  return {
    success: true,
    prefs: saved ? { targetTitles: saved.targetTitles, workplace: saved.workplace } : null,
    suggestedTitles: suggested,
    matchedAt: saved?.matchedAt?.toISOString() ?? null,
    matches,
    total,
    limit,
    isPro,
  }
}

// Before the feed tables exist (SQL not pasted yet) the feed is just empty.
const missingTable = (e: unknown) => /does not exist|P2021|P2022/i.test(String((e as { code?: string })?.code ?? '') + String((e as Error)?.message ?? ''))

export async function GET(request: NextRequest) {
  const ctx = await context(request.nextUrl.searchParams.get('resumeId'))
  if ('error' in ctx) return ctx.error
  try {
    return NextResponse.json(await body(ctx.userId, ctx.resume))
  } catch (e) {
    if (missingTable(e)) return NextResponse.json({ success: true, prefs: null, suggestedTitles: [], matchedAt: null, matches: [], total: 0, limit: 0, isPro: false, unavailable: true })
    throw e
  }
}

export async function POST(request: NextRequest) {
  const input = await request.json().catch(() => null)
  const ctx = await context(input?.resumeId)
  if ('error' in ctx) return ctx.error
  const rate = checkRateLimit(`feed:${ctx.userId}`)
  if (!rate.allowed) return NextResponse.json(rateLimitResponseBody(rate.retryAfterSeconds), { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })

  try {
    const saved = await loadPrefs(ctx.resume.id)
    const prefs = readPrefs(input, saved ?? { targetTitles: [], workplace: 'both' })
    await savePrefs(ctx.userId, ctx.resume.id, prefs)
    const outcome = await matchForResume(ctx.userId, ctx.resume, prefs)
    const out = await body(ctx.userId, ctx.resume)
    if (!outcome.ok) return NextResponse.json({ ...out, success: false, error: outcome.error }, { status: outcome.status })
    return NextResponse.json({ ...out, run: { scored: outcome.run.scored, skippedNoBudget: outcome.run.skippedNoBudget } })
  } catch (e) {
    if (missingTable(e)) return NextResponse.json({ success: false, error: 'Job matches are almost ready. Check back soon.' }, { status: 503 })
    throw e
  }
}
