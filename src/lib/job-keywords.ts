// One keyword list per job post. The model picks a job's 10-20 keywords once; after that
// the fit check and every re-tailor of the same post reuse the list saved on the user's
// last tailor of it (or on the shared job, for a post from their matches), so before/after
// scores compare across runs and the fit check skips its model call.
import { prisma } from '@/lib/prisma'

const MIN_KEYWORDS = 5

/** This user's latest keywords for exactly this job description, else the shared job's, or null. */
export async function savedJobKeywords(userId: string, description: string): Promise<string[] | null> {
  if (!description.trim()) return null
  const previous = await prisma.jobApplication.findFirst({
    where: { userId, jobDescription: description, keywords: { isEmpty: false } },
    orderBy: { updatedAt: 'desc' },
    select: { keywords: true },
  })
  const keywords = previous?.keywords ?? []
  if (keywords.length >= MIN_KEYWORDS) return keywords
  // A job from their matches: the same post's shared list, so the Tailor card shows the same
  // % as the match did, and nobody pays for the keywords twice.
  try {
    const shared = await prisma.job.findFirst({ where: { description, keywords: { isEmpty: false } }, select: { keywords: true } })
    return (shared?.keywords.length ?? 0) >= MIN_KEYWORDS ? shared!.keywords : null
  } catch {
    // The feed tables may not exist yet.
    return null
  }
}
