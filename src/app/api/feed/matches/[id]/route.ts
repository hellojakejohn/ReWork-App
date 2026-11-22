// One match: PATCH { action: 'save' | 'unsave' | 'dismiss' | 'seen' | 'tailored', applicationId? }
// GET -> the full job (title, company, description, url) to fill the Job card for tailoring.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAccess } from '@/lib/entitlements'
import { trackerLimitFor } from '@/lib/plans'

export const runtime = 'nodejs'

async function own(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const
  const match = await prisma.jobMatch.findFirst({ where: { id, userId: session.user.id } })
  if (!match) return { error: NextResponse.json({ error: 'Match not found' }, { status: 404 }) } as const
  return { userId: session.user.id, match } as const
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await own((await params).id)
  if ('error' in ctx) return ctx.error
  const job = await prisma.job.findUnique({ where: { id: ctx.match.jobId }, select: { title: true, company: true, location: true, description: true, url: true, closedAt: true, source: true } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  await prisma.jobMatch.update({ where: { id: ctx.match.id }, data: { seenAt: ctx.match.seenAt ?? new Date() } })
  // Adzuna only sends a short preview of the ad: the Job card asks for the full post.
  return NextResponse.json({ success: true, job: { ...job, closed: !!job.closedAt, closedAt: undefined, source: undefined, preview: job.source === 'adzuna' } })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await own((await params).id)
  if ('error' in ctx) return ctx.error
  const input = await request.json().catch(() => null)
  const now = new Date()
  const action = input?.action
  let data: Record<string, Date | string | null>
  if (action === 'save') {
    data = { savedAt: now, dismissedAt: null }
    // Saving puts it in the tracker's Saved column (once), within the plan's tracker limit.
    if (!ctx.match.applicationId) {
      const applicationId = await trackSavedMatch(ctx.userId, ctx.match.jobId, ctx.match.resumeId, now)
      if (applicationId) data.applicationId = applicationId
      else {
        await prisma.jobMatch.update({ where: { id: ctx.match.id }, data })
        return NextResponse.json({ success: true, tracked: false })
      }
    }
  }
  else if (action === 'unsave') data = { savedAt: null }
  else if (action === 'dismiss') data = { dismissedAt: now }
  else if (action === 'seen') data = { seenAt: ctx.match.seenAt ?? now }
  else if (action === 'tailored' && typeof input?.applicationId === 'string') {
    const app = await prisma.jobApplication.findFirst({ where: { id: input.applicationId, userId: ctx.userId }, select: { id: true } })
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    data = { applicationId: app.id, seenAt: ctx.match.seenAt ?? now }
  } else return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  await prisma.jobMatch.update({ where: { id: ctx.match.id }, data })
  return NextResponse.json({ success: true, ...(action === 'save' ? { tracked: true } : {}) })
}

/** A DRAFT tracker card for a saved match. Null when the free tracker is full or the job is gone. */
async function trackSavedMatch(userId: string, jobId: string, resumeId: string, now: Date): Promise<string | null> {
  const access = await getAccess(userId)
  const limit = trackerLimitFor(access.isPro)
  if (Number.isFinite(limit) && (await prisma.jobApplication.count({ where: { userId } })) >= limit) return null
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { title: true, company: true, location: true, description: true, url: true } })
  if (!job) return null
  const resume = await prisma.resume.findFirst({ where: { id: resumeId, userId }, select: { id: true } })
  if (!resume) return null
  const row = await prisma.jobApplication.create({
    data: {
      userId,
      resumeId: resume.id,
      jobTitle: job.title.slice(0, 200),
      company: job.company.slice(0, 200),
      jobDescription: job.description,
      jobUrl: job.url,
      keywords: [],
      status: 'DRAFT',
      statusUpdatedAt: now,
      suggestions: { jobLocation: job.location.slice(0, 200) },
    },
    select: { id: true },
  })
  return row.id
}
