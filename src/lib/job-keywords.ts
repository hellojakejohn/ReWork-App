// One keyword list per job post. The model picks a job's 10-20 keywords once; after that
// the fit check and every re-tailor of the same post reuse the list saved on the user's
// last tailor of it, so before/after scores compare across runs and the fit check skips
// its model call.
import { prisma } from '@/lib/prisma'

const MIN_KEYWORDS = 5

/** The keywords from this user's latest tailor of exactly this job description, or null. */
export async function savedJobKeywords(userId: string, description: string): Promise<string[] | null> {
  if (!description.trim()) return null
  const previous = await prisma.jobApplication.findFirst({
    where: { userId, jobDescription: description, keywords: { isEmpty: false } },
    orderBy: { updatedAt: 'desc' },
    select: { keywords: true },
  })
  const keywords = previous?.keywords ?? []
  return keywords.length >= MIN_KEYWORDS ? keywords : null
}
