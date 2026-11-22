// Email settings per user (email_prefs). No row = the defaults: weekly on. Fails soft: a
// missing table or a DB blip never breaks sign-up, settings or the cron.
import { prisma } from '@/lib/prisma'

export interface EmailPrefsState {
  weekly: boolean
  lastWeeklyAt: Date | null
  unsubscribedAt: Date | null
}

export const DEFAULT_PREFS: EmailPrefsState = { weekly: true, lastWeeklyAt: null, unsubscribedAt: null }

export async function getEmailPrefs(userId: string): Promise<EmailPrefsState | null> {
  try {
    const row = await prisma.emailPrefs.findUnique({ where: { userId } })
    return row ? { weekly: row.weekly && !row.unsubscribedAt, lastWeeklyAt: row.lastWeeklyAt, unsubscribedAt: row.unsubscribedAt } : DEFAULT_PREFS
  } catch (error) {
    console.error('[email] prefs unreadable:', (error as Error)?.message)
    return null
  }
}

/** Turns the weekly email on or off. Off from an unsubscribe link also stamps unsubscribedAt. */
export async function setWeekly(userId: string, on: boolean, via: 'settings' | 'unsubscribe' = 'settings'): Promise<boolean> {
  const data = { weekly: on, unsubscribedAt: on ? null : via === 'unsubscribe' ? new Date() : null }
  try {
    await prisma.emailPrefs.upsert({ where: { userId }, create: { userId, ...data }, update: data })
    return true
  } catch (error) {
    console.error('[email] prefs not saved:', (error as Error)?.message)
    return false
  }
}

/**
 * Claims this week's send for a user: sets lastWeeklyAt only if it's older than `cutoff`
 * (or never set). True = this run owns the send; two overlapping cron runs can't both win.
 */
export async function claimWeekly(userId: string, cutoff: Date, now: Date): Promise<boolean> {
  try {
    await prisma.emailPrefs.upsert({ where: { userId }, create: { userId }, update: {} })
    const { count } = await prisma.emailPrefs.updateMany({
      where: { userId, weekly: true, unsubscribedAt: null, OR: [{ lastWeeklyAt: null }, { lastWeeklyAt: { lt: cutoff } }] },
      data: { lastWeeklyAt: now },
    })
    return count === 1
  } catch (error) {
    console.error('[email] claim failed:', (error as Error)?.message)
    return false
  }
}
