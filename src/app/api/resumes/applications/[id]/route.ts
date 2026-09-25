import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { toApplicationDetail } from '@/lib/application-dto'
import { applyChangeDecision } from '@/lib/tailor-changes'
import type { TailorReport } from '@/types/tailor'

// GET: one tailored resume for the Result card.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const application = await prisma.jobApplication.findFirst({ where: { id, userId: session.user.id } })
  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true, application: toApplicationDetail(application) })
}

// PATCH { changeId, status: 'accepted' | 'reverted' }: Accept/Revert one bullet change.
// Updates the saved tailored resume so the PDF download matches what the user chose.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  let body: { changeId?: unknown; status?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (typeof body.changeId !== 'string' || (body.status !== 'accepted' && body.status !== 'reverted')) {
    return NextResponse.json({ error: "changeId and status ('accepted' | 'reverted') are required" }, { status: 400 })
  }
  const status = body.status

  const application = await prisma.jobApplication.findFirst({ where: { id, userId: session.user.id } })
  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }
  const report = (application.suggestions ?? {}) as unknown as TailorReport
  const change = report.changes?.find((c) => c.id === body.changeId)
  if (!change) {
    return NextResponse.json({ error: 'Change not found' }, { status: 404 })
  }

  const structured = applyChangeDecision((application.optimizedStructured ?? {}) as Record<string, unknown>, change, status)
  const nextReport: TailorReport = {
    ...report,
    changes: report.changes!.map((c) => (c.id === change.id ? { ...c, status } : c)),
  }
  const updated = await prisma.jobApplication.update({
    where: { id: application.id },
    data: {
      optimizedStructured: structured as Prisma.InputJsonValue,
      suggestions: nextReport as unknown as Prisma.InputJsonValue,
    },
  })
  return NextResponse.json({ success: true, application: toApplicationDetail(updated) })
}
