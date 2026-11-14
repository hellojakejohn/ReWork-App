// Apply assist, server side: the application kit the extension fills a form with. Built for the
// job the user last pressed Apply on in ReWork (an apply_started event, at most a few hours old).
// Server only.
import { prisma } from '@/lib/prisma'
import { masterToParsed } from '@/lib/master-resume'
import { splitName, type ApplyPacket } from '@/lib/apply-fill'

/** How long after pressing Apply the extension may still fill that job's form. */
export const APPLY_WINDOW_MS = 3 * 60 * 60 * 1000

const linkFor = (links: { label: string; url: string }[], re: RegExp) => links.find((l) => re.test(l.url) || re.test(l.label))?.url ?? ''

export async function latestApplyPacket(userId: string, now = new Date()): Promise<(ApplyPacket & { resumeId: string }) | null> {
  const started = await prisma.event.findFirst({
    where: { userId, name: 'apply_started', createdAt: { gte: new Date(now.getTime() - APPLY_WINDOW_MS) } },
    orderBy: { createdAt: 'desc' },
    select: { props: true },
  })
  const applicationId = (started?.props as { applicationId?: unknown } | null)?.applicationId
  if (typeof applicationId !== 'string') return null
  const app = await prisma.jobApplication.findFirst({
    where: { id: applicationId, userId },
    select: { id: true, resumeId: true, jobTitle: true, company: true, jobUrl: true, coverLetter: true, suggestions: true, resume: true },
  })
  if (!app) return null

  const contact = masterToParsed(app.resume).contact
  const { firstName, lastName } = splitName(contact.fullName)
  const linkedin = linkFor(contact.links, /linkedin/i)
  const github = linkFor(contact.links, /github/i)
  const website = contact.links.find((l) => l.url !== linkedin && l.url !== github)?.url ?? ''
  const letter = (app.coverLetter as { text?: unknown } | null)?.text
  const saved = (app.suggestions as { answers?: unknown } | null)?.answers
  const answers = Array.isArray(saved)
    ? saved
        .filter((a): a is { question: string; answer: string } => !!a && typeof a.question === 'string' && typeof a.answer === 'string')
        .map((a) => ({ question: a.question, answer: a.answer }))
    : []

  return {
    applicationId: app.id,
    resumeId: app.resumeId,
    jobTitle: app.jobTitle,
    company: app.company,
    jobUrl: app.jobUrl ?? '',
    contact: { firstName, lastName, fullName: contact.fullName, email: contact.email, phone: contact.phone, location: contact.location, linkedin, github, website },
    coverLetter: typeof letter === 'string' ? letter : '',
    answers,
  }
}
