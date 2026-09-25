import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { toMasterDTO } from '@/lib/master-dto'
import { toApplicationSummary } from '@/lib/application-dto'
import { getCoverLetterQuota, getTailorQuota, quotaDTO } from '@/lib/tailor-quota'

// GET: everything the one-page flow needs on load: master resumes (normalized),
// recent tailored resumes, and this month's tailor and cover letter quotas.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  try {
    const [resumes, applications, quota, coverLetterQuota] = await Promise.all([
      prisma.resume.findMany({
        where: { userId, isActive: true },
        select: {
          id: true,
          title: true,
          originalFileName: true,
          createdAt: true,
          updatedAt: true,
          originalContent: true,
          contactInfo: true,
          professionalSummary: true,
          workExperience: true,
          education: true,
          skills: true,
          projects: true,
          additionalSections: true,
          hiddenAt: true,
          parserVersion: true,
          structuredDataVersion: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.jobApplication.findMany({
        where: { userId },
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
      }),
      getTailorQuota(userId),
      getCoverLetterQuota(userId),
    ])

    return NextResponse.json({
      success: true,
      masters: resumes.map(toMasterDTO),
      applications: applications.map(toApplicationSummary),
      quota: quotaDTO(quota),
      coverLetterQuota: quotaDTO(coverLetterQuota),
    })
  } catch (error) {
    console.error('❌ Resumes fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch resumes' }, { status: 500 })
  }
}
