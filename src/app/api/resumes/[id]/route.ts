import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { masterToParsed, parsedToMaster } from '@/lib/master-resume'
import { toMasterDTO } from '@/lib/master-dto'

async function findOwned(resumeId: string, userId: string) {
  return prisma.resume.findFirst({ where: { id: resumeId, userId, isActive: true } })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const resume = await findOwned(id, session.user.id)
  if (!resume) {
    return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true, master: toMasterDTO(resume) })
}

// PATCH { resume: ParsedResume, title? } from the inline "Fix something" editor.
// Saving counts as the user having reviewed the parse, so needsReview is cleared.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  let body: { resume?: unknown; title?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!body.resume || typeof body.resume !== 'object' || !('contact' in body.resume)) {
    return NextResponse.json({ error: 'resume is required' }, { status: 400 })
  }

  const existing = await findOwned(id, session.user.id)
  if (!existing) {
    return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
  }

  // Round-trip through the stored shape so whatever the client sent is normalized.
  const resume = masterToParsed(parsedToMaster(body.resume as never))
  const master = parsedToMaster(resume)
  const original = (existing.originalContent ?? {}) as Record<string, unknown>
  const parse = (original.parse ?? {}) as Record<string, unknown>

  const updated = await prisma.resume.update({
    where: { id: existing.id },
    data: {
      ...(typeof body.title === 'string' && body.title.trim() ? { title: body.title.trim().slice(0, 120) } : {}),
      ...(master as unknown as Record<string, Prisma.InputJsonValue>),
      currentContent: resume as unknown as Prisma.InputJsonValue,
      originalContent: { ...original, parse: { ...parse, needsReview: [], reviewedAt: new Date().toISOString() } } as Prisma.InputJsonValue,
      lastStructuredUpdate: new Date(),
    },
  })
  return NextResponse.json({ success: true, master: toMasterDTO(updated) })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const existing = await findOwned(id, session.user.id)
  if (!existing) {
    return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
  }
  // Soft delete: tailored resumes made from it stay readable.
  await prisma.resume.update({ where: { id: existing.id }, data: { isActive: false } })
  return NextResponse.json({ success: true })
}
