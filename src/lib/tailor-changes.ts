// The Changes tab: per-bullet before/after/reason, and applying Accept/Revert to a saved
// tailored resume. Pure functions.
import { closestMasterBullet } from '@/lib/fact-guard'
import { normalizeSpace } from '@/lib/resume-text'
import type { BulletChange, TailorInput, TailorOutput } from '@/types/tailor'

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRecord = Record<string, any>

const same = (a: string, b: string) => normalizeSpace(a).toLowerCase() === normalizeSpace(b).toLowerCase()

/** Every rewritten bullet (and the summary), paired with the master text it came from. */
export function buildChanges(master: TailorInput, cleaned: TailorOutput): BulletChange[] {
  const changes: BulletChange[] = []

  if (cleaned.summary && master.summary && !same(cleaned.summary, master.summary)) {
    changes.push({
      id: 'summary',
      section: 'summary',
      entryId: 'summary',
      entryLabel: 'Summary',
      index: -1,
      before: master.summary,
      after: cleaned.summary,
      reason: 'Repositioned for this job',
      status: 'accepted',
    })
  }

  const entries = [
    ...cleaned.roles.map((r) => ({
      section: 'roles' as const,
      id: r.id,
      bullets: r.bullets,
      source: master.roles.find((m) => m.id === r.id),
      label: (m?: { title: string; company: string }) => (m ? [m.title, m.company].filter(Boolean).join(' at ') : r.title),
    })),
    ...cleaned.projects.map((p) => ({
      section: 'projects' as const,
      id: p.id,
      bullets: p.bullets,
      source: master.projects.find((m) => m.id === p.id),
      label: (m?: { name: string }) => m?.name || p.name,
    })),
  ]

  for (const entry of entries) {
    const masterBullets = entry.source?.bullets ?? []
    entry.bullets.forEach((bullet, index) => {
      const before = masterBullets.some((b) => same(b, bullet.text)) ? bullet.text : closestMasterBullet(bullet.text, masterBullets)
      if (before !== undefined && same(before, bullet.text)) return // unchanged
      changes.push({
        id: `${entry.id}:${index}`,
        section: entry.section,
        entryId: entry.id,
        entryLabel: entry.label(entry.source as never),
        index,
        before: before ?? '',
        after: bullet.text,
        reason: bullet.reason,
        status: 'accepted',
      })
    })
  }
  return changes
}

/**
 * Sets one change's text in a saved tailored resume (JobApplication.optimizedStructured):
 * `after` when accepted, `before` when reverted. A reverted bullet with no master
 * counterpart is blanked and dropped at render time. Returns a new object.
 */
export function applyChangeDecision(structured: AnyRecord, change: BulletChange, status: BulletChange['status']): AnyRecord {
  const next: AnyRecord = JSON.parse(JSON.stringify(structured ?? {}))
  const text = status === 'reverted' ? change.before : change.after

  if (change.section === 'summary') {
    if (next.professionalSummary && typeof next.professionalSummary === 'object') next.professionalSummary.summary = text
    else next.professionalSummary = { summary: text }
    return next
  }

  const key = change.section === 'roles' ? 'workExperience' : 'projects'
  const entry = (Array.isArray(next[key]) ? next[key] : []).find((e: AnyRecord) => e?.id === change.entryId)
  if (!entry) return next
  const bullets: string[] = Array.isArray(entry.achievements) ? entry.achievements : []
  if (change.index < 0 || change.index >= bullets.length) return next
  bullets[change.index] = text
  entry.achievements = bullets
  return next
}
