// GET: the tracker's cards. FREE sees its FREE_TRACKER_APPLICATIONS newest, Pro all.
// POST { title, company, url?, description?, location?, resumeId? }: track a job without
//   tailoring it (the tracker's "Add a job"). FREE can't add past the limit.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAccess } from '@/lib/entitlements'
import { FREE_TRACKER_APPLICATIONS, INPUT_LIMITS, PRICING, trackerLimitFor } from '@/lib/plans'
import { track } from '@/lib/track'
import { toTrackerCard } from '@/lib/application-dto'

const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const access = await getAccess(userId)
  const limit = trackerLimitFor(access.isPro)

  const [total, rows] = await Promise.all([
    prisma.jobApplication.count({ where: { userId } }),
    prisma.jobApplication.findMany({
      where: { userId },
      select: {
        id: true,
        resumeId: true,
        jobTitle: true,
        company: true,
        jobUrl: true,
        createdAt: true,
        updatedAt: true,
        matchScore: true,
        categoryScores: true,
        status: true,
        statusUpdatedAt: true,
        appliedAt: true,
        notes: true,
        followUpAt: true,
        optimizedStructured: true,
        coverLetter: true,
      },
      orderBy: { createdAt: 'desc' },
      ...(Number.isFinite(limit) ? { take: limit } : {}),
    }),
  ])

  return NextResponse.json({
    success: true,
    isPro: access.isPro,
    total,
    limit: Number.isFinite(limit) ? limit : null,
    applications: rows.map(toTrackerCard),
  })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const body = await request.json().catch(() => null)
  const title = clip(body?.title, 200)
  const company = clip(body?.company, 200)
  if (!title || !company) {
    return NextResponse.json({ error: 'A job title and company are required.' }, { status: 400 })
  }

  const access = await getAccess(userId)
  const limit = trackerLimitFor(access.isPro)
  if (Number.isFinite(limit) && (await prisma.jobApplication.count({ where: { userId } })) >= limit) {
    await track('limit_hit', { kind: 'tracker' }, userId)
    return NextResponse.json(
      {
        error: `Free accounts can track up to ${FREE_TRACKER_APPLICATIONS} applications. Go Pro to track every job: ${PRICING.monthly.display} or ${PRICING.pass.display}.`,
        upgradeRequired: true,
      },
      { status: 402 }
    )
  }

  // Every application hangs off a master resume. Use the one asked for if it's theirs,
  // else their newest active one.
  const resume =
    (typeof body?.resumeId === 'string' && (await prisma.resume.findFirst({ where: { id: body.resumeId, userId, isActive: true }, select: { id: true } }))) ||
    (await prisma.resume.findFirst({ where: { userId, isActive: true }, orderBy: [{ hiddenAt: { sort: 'asc', nulls: 'first' } }, { updatedAt: 'desc' }], select: { id: true } }))
  if (!resume) {
    return NextResponse.json({ error: 'Upload your resume first, then you can track jobs here.' }, { status: 400 })
  }

  const url = clip(body?.url, 2000)
  const now = new Date()
  const row = await prisma.jobApplication.create({
    data: {
      userId,
      resumeId: resume.id,
      jobTitle: title,
      company,
      jobDescription: clip(body?.description, INPUT_LIMITS.jobDescriptionChars),
      jobUrl: /^https?:\/\//i.test(url) ? url : null,
      keywords: [],
      status: 'DRAFT',
      statusUpdatedAt: now,
      suggestions: { jobLocation: clip(body?.location, 200) },
    },
  })
  return NextResponse.json({ success: true, application: toTrackerCard(row) })
}
