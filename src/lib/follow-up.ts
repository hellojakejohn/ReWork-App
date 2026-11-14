// Follow-up nudges: which tracked jobs are due a short check-in email, and that email.
// No AI, client-safe. A job is due when its follow-up date has come, or when it has sat in
// Applied for FOLLOW_UP_AFTER_DAYS with no reply and no date set. Snoozing sets the date.
import type { ApplicationStatus } from '@prisma/client'
import { columnOf, type TrackerColumn } from '@/lib/tracker'

export const FOLLOW_UP_AFTER_DAYS = 7
const DAY = 86_400_000

export interface FollowUpInput {
  status: ApplicationStatus
  appliedAt: string | null
  statusUpdatedAt: string
  followUpAt: string | null // YYYY-MM-DD
}

export interface FollowUpDue {
  column: TrackerColumn
  /** Whole days since they applied (or last moved), for "Applied 9 days ago". */
  days: number
  /** "date": the follow-up date they set has come. "quiet": no reply after a week. */
  reason: 'date' | 'quiet'
}

/** YYYY-MM-DD in local time. */
export function localISODate(d: Date): string {
  return d.toLocaleDateString('en-CA')
}

export function addDaysISO(now: Date, days: number): string {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  return localISODate(d)
}

export function followUpDue(app: FollowUpInput, now = new Date()): FollowUpDue | null {
  const column = columnOf(app.status)
  if (column === 'saved' || column === 'offer' || column === 'rejected') return null
  const since = new Date(column === 'applied' ? (app.appliedAt ?? app.statusUpdatedAt) : app.statusUpdatedAt).getTime()
  const days = Number.isFinite(since) ? Math.max(0, Math.floor((now.getTime() - since) / DAY)) : 0
  if (app.followUpAt) return app.followUpAt <= localISODate(now) ? { column, days, reason: 'date' } : null
  if (column === 'applied' && days >= FOLLOW_UP_AFTER_DAYS) return { column, days, reason: 'quiet' }
  return null
}

export function dueLine(due: FollowUpDue): string {
  const ago = due.days === 0 ? 'today' : due.days === 1 ? 'yesterday' : `${due.days} days ago`
  if (due.column === 'interview') return due.reason === 'date' ? 'Interview follow-up due' : `Interview ${ago}`
  return due.reason === 'quiet' ? `Applied ${ago}, no reply yet` : `Applied ${ago}. Your follow-up date is here`
}

export interface FollowUpEmail {
  subject: string
  body: string
}

/** A short, polite check-in. Only facts we know: the role, the company, when they applied. */
export function followUpEmail(job: { jobTitle: string; company: string; appliedAt: string | null; column: TrackerColumn }, senderName: string): FollowUpEmail {
  const role = job.jobTitle.trim() || 'the open role'
  const company = job.company.trim() || 'your team'
  const name = senderName.trim()
  const sign = name ? `Thank you,\n${name}` : 'Thank you'
  if (job.column === 'interview') {
    return {
      subject: `Following up: ${role} interview`,
      body: [
        'Hi,',
        `Thank you again for taking the time to talk with me about the ${role} role at ${company}. I enjoyed learning more about the team and the work.`,
        "I wanted to check in on next steps. I'm still very interested, and I'm happy to share anything else that would help.",
        sign,
      ].join('\n\n'),
    }
  }
  const when = job.appliedAt ? ` on ${new Date(job.appliedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}` : ''
  return {
    subject: `Following up on my ${role} application`,
    body: [
      'Hi,',
      `I applied for the ${role} role at ${company}${when} and wanted to follow up. I'm still very interested in the position and would welcome the chance to talk about how I could help.`,
      "I'm happy to send anything else that would be useful. Thanks for your time.",
      sign,
    ].join('\n\n'),
  }
}

/** A mailto: link that opens the email in their mail app (no recipient: they add it). */
export function mailtoHref(email: FollowUpEmail): string {
  return `mailto:?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`
}
