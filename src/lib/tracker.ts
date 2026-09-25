// Application tracker: columns, status transitions and the stats row. Pure and
// client-safe; the API applies transitionPatch to the JobApplication row.
import type { ApplicationStatus } from '@prisma/client'

export type TrackerColumn = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected'

// The existing ApplicationStatus enum, relabeled for people. DRAFT (tracked, not tailored)
// and OPTIMIZED (tailored) are both "Saved".
export const TRACKER_COLUMNS: { id: TrackerColumn; label: string; statuses: ApplicationStatus[] }[] = [
  { id: 'saved', label: 'Saved', statuses: ['DRAFT', 'OPTIMIZED'] },
  { id: 'applied', label: 'Applied', statuses: ['APPLIED'] },
  { id: 'interview', label: 'Interview', statuses: ['INTERVIEW'] },
  { id: 'offer', label: 'Offer', statuses: ['OFFER'] },
  { id: 'rejected', label: 'Rejected', statuses: ['REJECTED'] },
]

export function isTrackerColumn(value: unknown): value is TrackerColumn {
  return TRACKER_COLUMNS.some((c) => c.id === value)
}

export function columnOf(status: ApplicationStatus): TrackerColumn {
  return TRACKER_COLUMNS.find((c) => c.statuses.includes(status))?.id ?? 'saved'
}

export interface TrackedState {
  status: ApplicationStatus
  tailored: boolean
  appliedAt: Date | null
  responseAt: Date | null
}

export interface TransitionPatch {
  status: ApplicationStatus
  statusUpdatedAt: Date
  appliedAt?: Date
  responseAt?: Date
}

/**
 * What changes when a card moves to `to`. Saved goes back to OPTIMIZED if the job was
 * tailored, DRAFT if it was only tracked. appliedAt is set the first time a card reaches
 * Applied (or skips straight past it); responseAt the first time it hears back. Moving a
 * card back never erases those dates. Returns null when nothing changes.
 */
export function transitionPatch(current: TrackedState, to: TrackerColumn, now = new Date()): TransitionPatch | null {
  if (columnOf(current.status) === to) return null
  const status: ApplicationStatus = to === 'saved' ? (current.tailored ? 'OPTIMIZED' : 'DRAFT') : (to.toUpperCase() as ApplicationStatus)
  const patch: TransitionPatch = { status, statusUpdatedAt: now }
  if (to !== 'saved' && !current.appliedAt) patch.appliedAt = now
  if ((to === 'interview' || to === 'offer' || to === 'rejected') && !current.responseAt) patch.responseAt = now
  return patch
}

// ---------- stats ----------

export interface StatsInput {
  status: ApplicationStatus
  appliedAt: string | Date | null
}

export interface TrackerStats {
  appliedThisWeek: number
  interviews: number
  applied: number // ever applied (anything past Saved)
  responseRate: number | null // 0-100, null until something was applied to
}

/** Monday 00:00 local time of the week containing `now`. */
export function startOfWeek(now: Date): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

export function trackerStats(apps: StatsInput[], now = new Date()): TrackerStats {
  const weekStart = startOfWeek(now).getTime()
  let appliedThisWeek = 0
  let interviews = 0
  let applied = 0
  let responses = 0
  for (const app of apps) {
    const column = columnOf(app.status)
    if (column === 'saved') continue
    applied++
    if (column === 'interview' || column === 'offer') interviews++
    if (column !== 'applied') responses++
    const at = app.appliedAt ? new Date(app.appliedAt).getTime() : NaN
    if (at >= weekStart && at <= now.getTime()) appliedThisWeek++
  }
  return { appliedThisWeek, interviews, applied, responseRate: applied ? Math.round((responses / applied) * 100) : null }
}
