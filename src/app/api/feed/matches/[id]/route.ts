// One match: PATCH { action: 'save' | 'unsave' | 'dismiss' | 'seen' | 'tailored', applicationId? }
// GET -> the full job (title, company, description, url) to fill the Job card for tailoring.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
  const job = await prisma.job.findUnique({ where: { id: ctx.match.jobId }, select: { title: true, company: true, location: true, description: true, url: true, closedAt: true } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  await prisma.jobMatch.update({ where: { id: ctx.match.id }, data: { seenAt: ctx.match.seenAt ?? new Date() } })
  return NextResponse.json({ success: true, job: { ...job, closed: !!job.closedAt, closedAt: undefined } })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await own((await params).id)
  if ('error' in ctx) return ctx.error
  const input = await request.json().catch(() => null)
  const now = new Date()
  const action = input?.action
  let data: Record<string, Date | string | null>
  if (action === 'save') data = { savedAt: now, dismissedAt: null }
  else if (action === 'unsave') data = { savedAt: null }
  else if (action === 'dismiss') data = { dismissedAt: now }
  else if (action === 'seen') data = { seenAt: ctx.match.seenAt ?? now }
  else if (action === 'tailored' && typeof input?.applicationId === 'string') {
    const app = await prisma.jobApplication.findFirst({ where: { id: input.applicationId, userId: ctx.userId }, select: { id: true } })
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    data = { applicationId: app.id, seenAt: ctx.match.seenAt ?? now }
  } else return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  await prisma.jobMatch.update({ where: { id: ctx.match.id }, data })
  return NextResponse.json({ success: true })
}
