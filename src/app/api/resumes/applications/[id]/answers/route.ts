// Application answers for one tailored job (src/lib/app-answers.ts). Saved on the row in
// suggestions.answers (newest first), so no migration.
// POST { question, length }      -> write an answer. FREE: FREE_ANSWERS_PER_MONTH, Pro fair use.
// PATCH { answerId, text }       -> save the user's edit. Not metered.
// DELETE { answerId }            -> remove one.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildTailorInput, type MasterResume } from '@/lib/tailor'
import { masterToParsed } from '@/lib/master-resume'
import { recruiterText } from '@/lib/recruiter-text'
import { AnswerError, MAX_ANSWERS, MAX_ANSWER_CHARS, MAX_QUESTION_CHARS, generateAnswer, isAnswerLength, readStoredAnswers, type StoredAnswer } from '@/lib/app-answers'
import { evidenceFacts } from '@/lib/evidence-shared'
import { getAccess } from '@/lib/entitlements'
import { getAnswersQuota } from '@/lib/answers-quota'
import { checkRateLimit, rateLimitResponseBody } from '@/lib/rate-limit'
import { FREE_ANSWERS_PER_MONTH, GO_PRO_OFFERS } from '@/lib/plans'
import { checkDailyCeiling } from '@/lib/daily-ceiling'
import { collectUsage, usageProps } from '@/lib/ai-usage'
import { aiPausedCheck, getAIBudget } from '@/lib/ai-cap'
import { msSince, track } from '@/lib/track'

export const runtime = 'nodejs'
export const maxDuration = 300

type Owned = NonNullable<Awaited<ReturnType<typeof findOwned>>>

async function findOwned(id: string, userId: string) {
  return prisma.jobApplication.findFirst({ where: { id, userId }, include: { resume: { select: { evidence: true } } } })
}

const report = (row: Owned) => ((row.suggestions ?? {}) as Record<string, unknown>)

async function saveAnswers(row: Owned, answers: StoredAnswer[]) {
  await prisma.jobApplication.update({
    where: { id: row.id },
    data: { suggestions: { ...report(row), answers } as unknown as Prisma.InputJsonValue },
  })
}

async function auth(params: Promise<{ id: string }>) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { id } = await params
  const row = await findOwned(id, session.user.id)
  if (!row) return { error: NextResponse.json({ error: 'Application not found' }, { status: 404 }) }
  return { userId: session.user.id, row }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await auth(params)
  if ('error' in a) return a.error
  const { userId, row } = a
  const body = await request.json().catch(() => ({}))
  const question = typeof body?.question === 'string' ? body.question.trim() : ''
  if (question.length < 5) return NextResponse.json({ error: 'Paste the question from the application.' }, { status: 400 })
  if (question.length > MAX_QUESTION_CHARS) return NextResponse.json({ error: `Keep the question under ${MAX_QUESTION_CHARS} characters.` }, { status: 400 })
  const length = isAnswerLength(body?.length) ? body.length : 'medium'
  if (!row.optimizedStructured) return NextResponse.json({ error: 'Tailor your resume for this job first.' }, { status: 400 })
  const existing = readStoredAnswers(report(row).answers)

  const rate = checkRateLimit(`answers:${userId}`)
  if (!rate.allowed) {
    return NextResponse.json(rateLimitResponseBody(rate.retryAfterSeconds), { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
  }
  const ceiling = await checkDailyCeiling(userId, 'answers')
  if (!ceiling.allowed) {
    await track('limit_hit', { kind: 'daily_answers' }, userId)
    return NextResponse.json({ success: false, error: ceiling.message }, { status: 429 })
  }
  const access = await getAccess(userId)
  const quota = await getAnswersQuota(userId, access.isPro)
  if (quota.remaining !== null && quota.remaining <= 0) {
    await track('limit_hit', { kind: 'answers' }, userId)
    return NextResponse.json(
      {
        success: false,
        error: `Free accounts get ${FREE_ANSWERS_PER_MONTH} application answers a month. Go Pro to answer every question: ${GO_PRO_OFFERS}.`,
        upgradeRequired: true,
      },
      { status: 402 }
    )
  }
  const ai = await getAIBudget(userId)
  const paused = await aiPausedCheck(ai, userId, 'application_answer')
  if (paused) return NextResponse.json(paused, { status: 429 })

  const master = (row.originalContent ?? {}) as MasterResume
  const tailored = masterToParsed(row.optimizedStructured as Record<string, unknown>)
  const start = Date.now()
  const { run, usage } = collectUsage(
    () =>
      generateAnswer({
        master: buildTailorInput(master),
        tailoredText: recruiterText(row.optimizedStructured),
        candidateName: tailored.contact.fullName,
        job: { title: row.jobTitle, company: row.company, description: row.jobDescription },
        question,
        length,
        extraFacts: evidenceFacts(row.resume.evidence),
      }),
    ai.scope
  )
  let answer: StoredAnswer
  try {
    answer = await run
  } catch (error) {
    await ai.settle(usage().costUsd)
    const known = error instanceof AnswerError
    await track('ai_error', { feature: 'application_answer', kind: known ? error.kind : 'unexpected', status: known ? error.status : 500, ...usageProps(usage()) }, userId)
    console.error('❌ Answer error:', known ? error.message : error)
    return NextResponse.json({ success: false, error: known ? error.userMessage : "We couldn't write that answer. Please try again." }, { status: known ? error.status : 500 })
  }
  await ai.settle(usage().costUsd)

  const answers = [answer, ...existing].slice(0, MAX_ANSWERS)
  try {
    await saveAnswers(row, answers)
  } catch (error) {
    console.error('❌ Answer save failed:', error)
    return NextResponse.json({ success: false, error: "We wrote the answer but couldn't save it. Please try again. This one didn't count." }, { status: 500 })
  }
  // Written after the save: the event is what FREE's monthly count and the daily ceiling read.
  await track('application_answer', { ms: msSince(start), length, needsYou: !!answer.needsYou, ...usageProps(usage()) }, userId)

  return NextResponse.json({
    success: true,
    answers,
    answersQuota: quota.remaining === null ? quota : { ...quota, used: quota.used + 1, remaining: Math.max(0, quota.remaining - 1) },
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await auth(params)
  if ('error' in a) return a.error
  const body = await request.json().catch(() => null)
  if (typeof body?.answerId !== 'string' || typeof body?.text !== 'string') {
    return NextResponse.json({ error: 'answerId and text are required' }, { status: 400 })
  }
  if (body.text.length > MAX_ANSWER_CHARS) return NextResponse.json({ error: 'That answer is too long.' }, { status: 400 })
  const answers = readStoredAnswers(report(a.row).answers)
  if (!answers.some((x) => x.id === body.answerId)) return NextResponse.json({ error: 'Answer not found' }, { status: 404 })
  const next = answers.map((x) => (x.id === body.answerId ? { ...x, answer: body.text, edited: true } : x))
  await saveAnswers(a.row, next)
  return NextResponse.json({ success: true, answers: next })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await auth(params)
  if ('error' in a) return a.error
  const body = await request.json().catch(() => null)
  if (typeof body?.answerId !== 'string') return NextResponse.json({ error: 'answerId is required' }, { status: 400 })
  const answers = readStoredAnswers(report(a.row).answers)
  const next = answers.filter((x) => x.id !== body.answerId)
  if (next.length === answers.length) return NextResponse.json({ error: 'Answer not found' }, { status: 404 })
  await saveAnswers(a.row, next)
  return NextResponse.json({ success: true, answers: next })
}

/** Quota for the panel before the first answer. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await auth(params)
  if ('error' in a) return a.error
  const access = await getAccess(a.userId)
  return NextResponse.json({ success: true, answersQuota: await getAnswersQuota(a.userId, access.isPro) })
}
