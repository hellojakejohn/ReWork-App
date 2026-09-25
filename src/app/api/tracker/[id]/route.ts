// PATCH { column?, notes?, followUpAt? }: move a card (sets appliedAt/responseAt the first
//   time, see src/lib/tracker.ts) and edit its notes and follow-up date.
// DELETE: remove an application (tailored resume and cover letter included).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { toTrackerCard } from '@/lib/application-dto'
import { isTrackerColumn, transitionPatch } from '@/lib/tracker'

const MAX_NOTES = 5000

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const application = await prisma.jobApplication.findFirst({ where: { id, userId: session.user.id } })
  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (body.column !== undefined) {
    if (!isTrackerColumn(body.column)) return NextResponse.json({ error: 'Unknown column' }, { status: 400 })
    const patch = transitionPatch(
      { status: application.status, tailored: !!application.optimizedStructured, appliedAt: application.appliedAt, responseAt: application.responseAt },
      body.column
    )
    if (patch) Object.assign(data, patch)
  }
  if (body.notes !== undefined) {
    if (typeof body.notes !== 'string') return NextResponse.json({ error: 'notes must be text' }, { status: 400 })
    data.notes = body.notes.slice(0, MAX_NOTES)
  }
  if (body.followUpAt !== undefined) {
    if (body.followUpAt === null || body.followUpAt === '') data.followUpAt = null
    else if (typeof body.followUpAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.followUpAt)) data.followUpAt = new Date(`${body.followUpAt}T12:00:00Z`)
    else return NextResponse.json({ error: 'followUpAt must be YYYY-MM-DD' }, { status: 400 })
  }

  const updated = Object.keys(data).length ? await prisma.jobApplication.update({ where: { id: application.id }, data }) : application
  return NextResponse.json({ success: true, application: toTrackerCard(updated) })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const result = await prisma.jobApplication.deleteMany({ where: { id, userId: session.user.id } })
  if (result.count === 0) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
