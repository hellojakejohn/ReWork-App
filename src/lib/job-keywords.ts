// One keyword list per job post. The model picks a job's 10-20 keywords once; after that
// the fit check and every re-tailor of the same post reuse the list saved on the user's
// last tailor of it (or on the shared job, for a post opened from their matches), so
// before/after scores compare across runs and the fit check skips its model call.
import { prisma } from '@/lib/prisma'

const MIN_KEYWORDS = 5

/**
 * This user's latest keywords for exactly this job description, else (for a job opened from
 * their matches) the shared job's list, so the Tailor card shows the same % as the match did
 * and nobody pays for the keywords twice. Null when neither has a full list.
 */
export async function savedJobKeywords(userId: string, description: string, matchId?: string | null): Promise<string[] | null> {
  if (!description.trim()) return null
  const previous = await prisma.jobApplication.findFirst({
    where: { userId, jobDescription: description, keywords: { isEmpty: false } },
    orderBy: { updatedAt: 'desc' },
    select: { keywords: true },
  })
  const keywords = previous?.keywords ?? []
  if (keywords.length >= MIN_KEYWORDS) return keywords
  if (!matchId) return null
  try {
    // Their own match, and only while the text is still that job's (not edited on the Job card).
    const match = await prisma.jobMatch.findFirst({ where: { id: matchId, userId }, select: { job: { select: { description: true, keywords: true } } } })
    const shared = match?.job
    return shared && shared.description === description && shared.keywords.length >= MIN_KEYWORDS ? shared.keywords : null
  } catch {
    // The feed tables may not exist yet.
    return null
  }
}
