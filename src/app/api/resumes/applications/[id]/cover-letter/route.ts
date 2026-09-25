// POST { tone }  -> write (or rewrite) the cover letter for this tailored resume. Metered:
//                   FREE gets FREE_COVER_LETTERS_PER_MONTH, Pro unlimited.
// PATCH { text, tone? } -> autosave the user's edits. Not metered.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildTailorInput, type MasterResume } from '@/lib/tailor'
import { masterToParsed } from '@/lib/master-resume'
import { toLayout } from '@/lib/resume-templates'
import { CoverLetterError, generateCoverLetter, isCoverLetterTone, readStoredCoverLetter, type StoredCoverLetter } from '@/lib/cover-letter'
import { evidenceFacts } from '@/lib/evidence-shared'
import { getCoverLetterQuota, incrementCoverLetterCount, quotaDTO } from '@/lib/tailor-quota'
import { checkRateLimit, rateLimitResponseBody } from '@/lib/rate-limit'
import { FREE_COVER_LETTERS_PER_MONTH, PRICING } from '@/lib/plans'
import { toApplicationDetail } from '@/lib/application-dto'
import { checkDailyCeiling } from '@/lib/daily-ceiling'
import { collectUsage, usageProps } from '@/lib/ai-usage'
import { msSince, track } from '@/lib/track'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_TEXT = 6000

/** The tailored resume as a recruiter would read it. */
function resumeText(structured: unknown): string {
  const l = toLayout(masterToParsed((structured ?? {}) as Record<string, unknown>))
  return [
    l.summary,
    ...l.experience.flatMap((e) => [[e.title, e.company, e.dates].filter(Boolean).join(', '), ...e.bullets.map((b) => `- ${b}`)]),
    ...l.projects.flatMap((p) => [p.name, ...p.bullets.map((b) => `- ${b}`), p.tech]),
    ...l.skills.map((g) => [g.group, g.items].filter(Boolean).join(': ')),
  ]
    .filter(Boolean)
    .join('\n')
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const tone = isCoverLetterTone(body?.tone) ? body.tone : 'professional'

  const application = await prisma.jobApplication.findFirst({
    where: { id, userId },
    include: { resume: { select: { evidence: true } } },
  })
  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }
  if (!application.optimizedStructured) {
    return NextResponse.json({ error: 'Tailor your resume for this job first.' }, { status: 400 })
  }

  const rate = checkRateLimit(`cover:${userId}`)
  if (!rate.allowed) {
    return NextResponse.json(rateLimitResponseBody(rate.retryAfterSeconds), {
      status: 429,
      headers: { 'Retry-After': String(rate.retryAfterSeconds) },
    })
  }

  const ceiling = await checkDailyCeiling(userId, 'coverLetter')
  if (!ceiling.allowed) {
    await track('limit_hit', { kind: 'daily_cover_letter' }, userId)
    return NextResponse.json({ success: false, error: ceiling.message }, { status: 429 })
  }

  const quota = await getCoverLetterQuota(userId)
  if (!quota.allowed) {
    await track('limit_hit', { kind: 'cover_letter' }, userId)
    return NextResponse.json(
      {
        success: false,
        error: `Free accounts get ${FREE_COVER_LETTERS_PER_MONTH} cover letter a month. Go Pro for unlimited cover letters: ${PRICING.monthly.display} or ${PRICING.pass.display}.`,
        upgradeRequired: true,
      },
      { status: 402 }
    )
  }

  // The master as it was when this version was tailored, so the letter and the resume agree.
  const master = (application.originalContent ?? {}) as MasterResume
  const tailored = masterToParsed(application.optimizedStructured as Record<string, unknown>)

  const start = Date.now()
  const { run, usage } = collectUsage(() =>
    generateCoverLetter({
      master: buildTailorInput(master),
      tailoredText: resumeText(application.optimizedStructured),
      candidateName: tailored.contact.fullName,
      job: { title: application.jobTitle, company: application.company, description: application.jobDescription },
      tone,
      extraFacts: evidenceFacts(application.resume.evidence),
    })
  )
  let letter: StoredCoverLetter
  try {
    letter = await run
  } catch (error) {
    await track(
      'ai_error',
      {
        feature: 'cover_letter',
        kind: error instanceof CoverLetterError ? error.kind : 'unexpected',
        status: error instanceof CoverLetterError ? error.status : 500,
        ...usageProps(usage()),
      },
      userId
    )
    if (error instanceof CoverLetterError) {
      console.error('❌ Cover letter error:', error.message)
      return NextResponse.json({ success: false, error: error.userMessage }, { status: error.status })
    }
    console.error('❌ Cover letter error:', error)
    return NextResponse.json({ success: false, error: "We couldn't write the letter. Please try again." }, { status: 500 })
  }

  const updated = await prisma.jobApplication.update({
    where: { id: application.id },
    data: { coverLetter: letter as unknown as Prisma.InputJsonValue, coverLetterUpdatedAt: new Date() },
  })
  await incrementCoverLetterCount(userId)
  await track('cover_letter_generated', { ms: msSince(start), tone, ...usageProps(usage()) }, userId)

  return NextResponse.json({
    success: true,
    application: toApplicationDetail(updated),
    coverLetterQuota: quotaDTO({ ...quota, used: quota.used + 1, remaining: Math.max(0, quota.remaining - 1), allowed: quota.used + 1 < quota.limit }),
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body || typeof body.text !== 'string') {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }
  if (body.text.length > MAX_TEXT) {
    return NextResponse.json({ error: 'That letter is too long.' }, { status: 400 })
  }

  const application = await prisma.jobApplication.findFirst({ where: { id, userId: session.user.id } })
  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }
  const existing = readStoredCoverLetter(application.coverLetter)
  if (!existing) {
    return NextResponse.json({ error: 'Write the letter first.' }, { status: 400 })
  }

  const next: StoredCoverLetter = {
    ...existing,
    text: body.text,
    tone: isCoverLetterTone(body.tone) ? body.tone : existing.tone,
    edited: true,
  }
  const now = new Date()
  await prisma.jobApplication.update({
    where: { id: application.id },
    data: { coverLetter: next as unknown as Prisma.InputJsonValue, coverLetterUpdatedAt: now },
  })
  return NextResponse.json({ success: true, coverLetter: next, coverLetterUpdatedAt: now.toISOString() })
}
