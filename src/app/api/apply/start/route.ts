// POST { applicationId } -> remembers "applying to this job now", so the extension knows which
// kit to fill the application form with (src/lib/apply-packet.ts).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { track } from '@/lib/track'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const input = await request.json().catch(() => null)
  const id = typeof input?.applicationId === 'string' ? input.applicationId : ''
  const app = id ? await prisma.jobApplication.findFirst({ where: { id, userId: session.user.id }, select: { id: true } }) : null
  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  await track('apply_started', { applicationId: app.id }, session.user.id)
  return NextResponse.json({ success: true })
}
