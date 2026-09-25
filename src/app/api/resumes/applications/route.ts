import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { toApplicationSummary } from '@/lib/application-dto'

// GET: the user's tailored resumes, newest first (the Recent drawer).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const applications = await prisma.jobApplication.findMany({
    // Tailored ones only; jobs tracked without tailoring live on the tracker.
    where: { userId: session.user.id, NOT: { optimizedStructured: { equals: Prisma.DbNull } } },
    select: {
      id: true,
      resumeId: true,
      jobTitle: true,
      company: true,
      jobUrl: true,
      createdAt: true,
      matchScore: true,
      categoryScores: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ success: true, applications: applications.map(toApplicationSummary) })
}
