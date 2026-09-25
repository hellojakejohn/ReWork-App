import { prisma } from './prisma'

/**
 * Resume upload counters (stats only; uploads aren't metered, see plans.ts).
 * Monthly count resets on the first upload of a new month.
 */

function needsMonthlyReset(lastResetDate: Date): boolean {
  const now = new Date()
  return now.getFullYear() > lastResetDate.getFullYear() ||
    (now.getFullYear() === lastResetDate.getFullYear() && now.getMonth() > lastResetDate.getMonth())
}

export async function incrementResumeCount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { resumeCountResetAt: true }
  })
  if (!user) throw new Error('User not found')

  const needsReset = needsMonthlyReset(user.resumeCountResetAt)
  await prisma.user.update({
    where: { id: userId },
    data: {
      monthlyResumesCreated: needsReset ? 1 : { increment: 1 },
      totalResumesCreated: { increment: 1 },
      resumeCountResetAt: needsReset ? new Date() : undefined,
      // Kept for backward compatibility
      resumesCreated: { increment: 1 }
    }
  })
}
