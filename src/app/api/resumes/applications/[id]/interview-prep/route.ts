// Interview prep for one tailored job (src/lib/interview-prep.ts). Saved on the row in
// suggestions.interviewPrep, so no migration.
// GET  -> the quota (the prep itself comes with the application).
// POST -> build (or rebuild) it. FREE: FREE_INTERVIEW_PREPS_PER_MONTH, Pro fair use.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildTailorInput, type MasterResume } from '@/lib/tailor'
import { masterToParsed } from '@/lib/master-resume'
import { allowedSourceText } from '@/lib/cover-letter'
import { PrepError, generateInterviewPrep, type StoredInterviewPrep } from '@/lib/interview-prep'
import { evidenceFacts } from '@/lib/evidence-shared'
import { getAccess } from '@/lib/entitlements'
import { afterUse, getInterviewPrepQuota } from '@/lib/answers-quota'
import { checkRateLimit, rateLimitResponseBody } from '@/lib/rate-limit'
import { FREE_INTERVIEW_PREPS_PER_MONTH, GO_PRO_OFFERS } from '@/lib/plans'
import { checkDailyCeiling } from '@/lib/daily-ceiling'
import { collectUsage, usageProps } from '@/lib/ai-usage'
import { aiPausedCheck, getAIBudget } from '@/lib/ai-cap'
import { msSince, track } from '@/lib/track'

export const runtime = 'nodejs'
export const maxDuration = 300

async function owned(params: Promise<{ id: string }>) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { id } = await params
  const row = await prisma.jobApplication.findFirst({ where: { id, userId: session.user.id }, include: { resume: { select: { evidence: true } } } })
  if (!row) return { error: NextResponse.json({ error: 'Application not found' }, { status: 404 }) }
  return { userId: session.user.id, row }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await owned(params)
  if ('error' in a) return a.error
  const access = await getAccess(a.userId)
  return NextResponse.json({ success: true, prepQuota: await getInterviewPrepQuota(a.userId, access.isPro) })
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await owned(params)
  if ('error' in a) return a.error
  const { userId, row } = a
  if (!row.optimizedStructured) return NextResponse.json({ error: 'Tailor your resume for this job first.' }, { status: 400 })

  const rate = checkRateLimit(`prep:${userId}`)
  if (!rate.allowed) {
    return NextResponse.json(rateLimitResponseBody(rate.retryAfterSeconds), { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
  }
  const ceiling = await checkDailyCeiling(userId, 'interviewPrep')
  if (!ceiling.allowed) {
    await track('limit_hit', { kind: 'daily_interview_prep' }, userId)
    return NextResponse.json({ success: false, error: ceiling.message }, { status: 429 })
  }
  const access = await getAccess(userId)
  const quota = await getInterviewPrepQuota(userId, access.isPro)
  if (quota.remaining !== null && quota.remaining <= 0) {
    await track('limit_hit', { kind: 'interview_prep' }, userId)
    return NextResponse.json(
      {
        success: false,
        error: `Free accounts get ${FREE_INTERVIEW_PREPS_PER_MONTH} interview prep a month. Go Pro to prep for every interview: ${GO_PRO_OFFERS}.`,
        upgradeRequired: true,
      },
      { status: 402 }
    )
  }
  const ai = await getAIBudget(userId)
  const paused = await aiPausedCheck(ai, userId, 'interview_prep')
  if (paused) return NextResponse.json(paused, { status: 429 })

  const tailored = masterToParsed(row.optimizedStructured as Record<string, unknown>)
  const job = { title: row.jobTitle, company: row.company, description: row.jobDescription }
  const allowedText = allowedSourceText({
    master: buildTailorInput((row.originalContent ?? {}) as MasterResume),
    candidateName: tailored.contact.fullName,
    job,
    extraFacts: evidenceFacts(row.resume.evidence),
  })
  const start = Date.now()
  const { run, usage } = collectUsage(() => generateInterviewPrep({ tailored, allowedText, job }), ai.scope)
  let prep: StoredInterviewPrep
  try {
    prep = await run
  } catch (error) {
    await ai.settle(usage().costUsd)
    const known = error instanceof PrepError
    await track('ai_error', { feature: 'interview_prep', kind: known ? error.kind : 'unexpected', status: known ? error.status : 500, ...usageProps(usage()) }, userId)
    console.error('❌ Interview prep error:', known ? error.message : error)
    return NextResponse.json({ success: false, error: known ? error.userMessage : "We couldn't build your interview prep. Please try again." }, { status: known ? error.status : 500 })
  }
  await ai.settle(usage().costUsd)

  try {
    await prisma.jobApplication.update({
      where: { id: row.id },
      data: { suggestions: { ...((row.suggestions ?? {}) as Record<string, unknown>), interviewPrep: prep } as unknown as Prisma.InputJsonValue },
    })
  } catch (error) {
    console.error('❌ Interview prep save failed:', error)
    return NextResponse.json({ success: false, error: "We built your prep but couldn't save it. Please try again. This one didn't count." }, { status: 500 })
  }
  await track('interview_prep', { ms: msSince(start), questions: prep.questions.length, ...usageProps(usage()) }, userId)
  return NextResponse.json({ success: true, interviewPrep: prep, prepQuota: afterUse(quota) })
}
