// The weekly "Your measurements" email run (docs/weekly-email-plan.md). Server only.
//
// For each person with a resume and a "what job do you want next" answer: refresh their
// matches (the same run as the Job card: list boards are already pulled, so most of it is
// free; new jobs' keywords are bought once and shared, under the feed's daily ceiling and
// their own AI cap), pick the best jobs first seen since their last email, and send.
// Nothing new = no email. Every person gets one `weekly_email` event saying what happened.
import { prisma } from '@/lib/prisma'
import { isAdminEmail } from '@/lib/admin'
import { SITE_URL } from '@/lib/site'
import { track } from '@/lib/track'
import { weightedScore } from '@/lib/keyword-coverage'
import { matchForResume } from '@/lib/feed/feed-server'
import { isWorkplace } from '@/lib/feed/match'
import { mailingAddress, weeklyMode, type WeeklyMode } from './config'
import { claimWeekly, getEmailPrefs } from './prefs'
import { sendEmail } from './send'
import { weeklyEmail, type EmailContent, type Footer, type WeeklyJob } from './templates'
import { unsubscribeToken } from './unsubscribe'
import { ACTIVE_DAYS, QUIET_SKIPS, WEEKLY_JOBS, firstName, pickWeeklyJobs, sendCutoff, weeklySince, weeklySkipReason, type Cadence } from './weekly-rules'

const DAY = 86_400_000

export function footerFor(userId: string, why: string): Footer {
  return {
    siteUrl: SITE_URL,
    unsubscribeUrl: `${SITE_URL}/unsubscribe?t=${encodeURIComponent(unsubscribeToken(userId))}`,
    settingsUrl: `${SITE_URL}/dashboard?settings=email`,
    mailingAddress: mailingAddress() || '(mailing address not set)',
    why,
  }
}

export const WEEKLY_WHY = 'You get this because you have a resume on ReWork and weekly job emails are on.'
export const DAILY_WHY = 'You get this because you have a resume on ReWork and the daily job brief is on.'
const whyFor = (cadence: Cadence) => (cadence === 'daily' ? DAILY_WHY : WEEKLY_WHY)

interface Recipient {
  userId: string
  email: string | null
  name: string | null
  resume: Parameters<typeof matchForResume>[1]
  targetTitles: string[]
  workplace: string
}

/** One person per user: the resume whose matches they ran most recently. */
async function recipients(): Promise<Recipient[]> {
  const rows = await prisma.feedPrefs.findMany({
    where: { resume: { isActive: true } },
    orderBy: [{ matchedAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
    include: { resume: true, user: { select: { id: true, email: true, name: true } } },
  })
  const seen = new Set<string>()
  const out: Recipient[] = []
  for (const r of rows) {
    if (seen.has(r.userId)) continue
    seen.add(r.userId)
    out.push({ userId: r.userId, email: r.user.email, name: r.user.name, resume: r.resume, targetTitles: r.targetTitles, workplace: r.workplace })
  }
  return out
}

async function lastActive(userIds: string[], now: Date): Promise<Map<string, Date>> {
  if (userIds.length === 0) return new Map()
  const rows = await prisma.event.groupBy({
    by: ['userId'],
    where: { userId: { in: userIds }, createdAt: { gte: new Date(now.getTime() - ACTIVE_DAYS * DAY) }, name: { notIn: ['ai_call', 'ai_inflight', 'weekly_email', 'feed_match'] } },
    _max: { createdAt: true },
  })
  return new Map(rows.filter((r) => r.userId && r._max.createdAt).map((r) => [r.userId!, r._max.createdAt!]))
}

/** The email for one person (also the /admin preview). Null when there's nothing new. */
export async function buildWeekly(userId: string, resumeId: string, name: string | null, since: Date, now = new Date(), cadence: Cadence = 'weekly'): Promise<{ content: EmailContent; jobs: number } | null> {
  const matches = await prisma.jobMatch.findMany({
    where: { userId, resumeId, dismissedAt: null, applicationId: null, job: { closedAt: null, firstSeenAt: { gte: since } } },
    orderBy: [{ rank: 'desc' }, { score: 'desc' }],
    take: 40,
    include: { job: { select: { title: true, company: true, location: true, remote: true, payLabel: true, firstSeenAt: true, closedAt: true, keywords: true, source: true } } },
  })
  const picked = pickWeeklyJobs(matches, since, WEEKLY_JOBS)
  if (picked.length === 0) return null
  const [checked, followUpsDue] = await Promise.all([
    prisma.job.count({ where: { closedAt: null } }),
    prisma.jobApplication.count({ where: { userId, status: 'APPLIED', followUpAt: { lte: now } } }).catch(() => 0),
  ])
  const utm = `utm_source=email&utm_medium=${cadence}`
  const jobs: WeeklyJob[] = picked.map((m) => ({
    title: m.job.title,
    company: m.job.company,
    location: m.job.location,
    remote: m.job.remote,
    payLabel: m.job.payLabel,
    adzuna: m.job.source === 'adzuna',
    score: m.score,
    reach: Math.max(m.score, weightedScore(m.job.keywords, [...m.present, ...m.related])),
    present: m.present,
    tailorUrl: `${SITE_URL}/dashboard?match=${encodeURIComponent(m.id)}&${utm}`,
  }))
  const content = weeklyEmail(
    { daily: cadence === 'daily', firstName: firstName(name), jobs, checked, followUpsDue, trackerUrl: `${SITE_URL}/dashboard/tracker?${utm}`, dashboardUrl: `${SITE_URL}/dashboard?${utm}` },
    footerFor(userId, whyFor(cadence))
  )
  return { content, jobs: jobs.length }
}

export interface WeeklySummary {
  mode: WeeklyMode
  cadence: Cadence
  considered: number
  sent: number
  dry: number
  skipped: Record<string, number>
  failed: number
  outOfTime: boolean
}

/**
 * One cron pass. Stops starting new people once `deadline` (ms epoch) is near; the next
 * pass (the cron repeats each Monday) picks up whoever is left, since sent people are
 * marked. `mode` defaults to EMAIL_WEEKLY.
 */
export async function runWeekly({ now = new Date(), deadline = Date.now() + 240_000, mode = weeklyMode(), cadence = 'weekly' }: { now?: Date; deadline?: number; mode?: WeeklyMode; cadence?: Cadence } = {}): Promise<WeeklySummary> {
  const summary: WeeklySummary = { mode, cadence, considered: 0, sent: 0, dry: 0, skipped: {}, failed: 0, outOfTime: false }
  if (mode === 'off') return summary
  const skip = async (userId: string, reason: string, extra: Record<string, number | string> = {}) => {
    summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1
    // Quiet reasons aren't worth an event row each.
    if (!QUIET_SKIPS.has(reason)) await track('weekly_email', { status: 'skipped', reason, mode, cadence, ...extra }, userId)
  }

  const people = await recipients()
  const active = await lastActive(people.map((p) => p.userId), now)
  for (const p of people) {
    if (Date.now() > deadline - 30_000) {
      summary.outOfTime = true
      break
    }
    summary.considered++
    if (mode === 'admins' && !isAdminEmail(p.email)) {
      await skip(p.userId, 'not_admin')
      continue
    }
    const prefs = await getEmailPrefs(p.userId)
    const reason = weeklySkipReason({ email: p.email, prefs, lastActiveAt: active.get(p.userId) ?? null }, now, cadence)
    if (reason) {
      await skip(p.userId, reason)
      continue
    }
    const since = weeklySince(prefs!.lastWeeklyAt, now, cadence)

    // Dry runs spend nothing: they read the matches already saved.
    if (mode !== 'dry') {
      if (!(await claimWeekly(p.userId, sendCutoff(now, cadence), now))) {
        await skip(p.userId, 'recent')
        continue
      }
      const refreshed = await matchForResume(p.userId, p.resume, {
        targetTitles: p.targetTitles,
        workplace: isWorkplace(p.workplace) ? p.workplace : 'both',
      }).catch(() => null)
      if (refreshed && !refreshed.ok) console.warn('[weekly] match refresh skipped:', refreshed.error)
    }

    let built: Awaited<ReturnType<typeof buildWeekly>>
    try {
      built = await buildWeekly(p.userId, p.resume.id, p.name, since, now, cadence)
    } catch (error) {
      summary.failed++
      await track('weekly_email', { status: 'failed', mode, cadence, error: String((error as Error)?.message).slice(0, 200) }, p.userId)
      continue
    }
    if (!built) {
      await skip(p.userId, 'no_new_jobs')
      continue
    }
    if (mode === 'dry') {
      summary.dry++
      await track('weekly_email', { status: 'dry', mode, cadence, jobs: built.jobs }, p.userId)
      continue
    }
    const res = await sendEmail({
      to: p.email!,
      subject: built.content.subject,
      html: built.content.html,
      text: built.content.text,
      unsubscribeUrl: footerFor(p.userId, whyFor(cadence)).unsubscribeUrl,
      tag: cadence,
    })
    if (res.ok) {
      summary.sent++
      await track('weekly_email', { status: 'sent', mode, cadence, jobs: built.jobs, resendId: res.id }, p.userId)
    } else {
      summary.failed++
      await track('weekly_email', { status: 'failed', mode, cadence, error: res.error }, p.userId)
    }
  }
  return summary
}
