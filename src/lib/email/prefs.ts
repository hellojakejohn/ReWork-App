// Email settings per user (email_prefs). No row = the defaults: weekly on. Fails soft: a
// missing table or a DB blip never breaks sign-up, settings or the cron.
import { prisma } from '@/lib/prisma'

export interface EmailPrefsState {
  weekly: boolean
  /** The daily brief instead of the weekly email (only when weekly is on). */
  daily: boolean
  lastWeeklyAt: Date | null
  unsubscribedAt: Date | null
}

export const DEFAULT_PREFS: EmailPrefsState = { weekly: true, daily: false, lastWeeklyAt: null, unsubscribedAt: null }

// Every read and write names its columns, so nothing breaks before the "daily" column's
// SQL is pasted: daily just reads as off until then.
const CORE = { weekly: true, lastWeeklyAt: true, unsubscribedAt: true } as const
const KEY = { userId: true } as const

export async function getEmailPrefs(userId: string): Promise<EmailPrefsState | null> {
  try {
    const row = await prisma.emailPrefs.findUnique({ where: { userId }, select: CORE })
    if (!row) return DEFAULT_PREFS
    const weekly = row.weekly && !row.unsubscribedAt
    const daily = weekly ? await readDaily(userId) : false
    return { weekly, daily, lastWeeklyAt: row.lastWeeklyAt, unsubscribedAt: row.unsubscribedAt }
  } catch (error) {
    console.error('[email] prefs unreadable:', (error as Error)?.message)
    return null
  }
}

async function readDaily(userId: string): Promise<boolean> {
  try {
    return (await prisma.emailPrefs.findUnique({ where: { userId }, select: { daily: true } }))?.daily ?? false
  } catch {
    return false
  }
}

export type Frequency = 'off' | 'weekly' | 'daily'
export const isFrequency = (v: unknown): v is Frequency => v === 'off' || v === 'weekly' || v === 'daily'
export const frequencyOf = (p: Pick<EmailPrefsState, 'weekly' | 'daily'>): Frequency => (!p.weekly ? 'off' : p.daily ? 'daily' : 'weekly')

/** Weekly, daily or off, from settings. Off keeps the daily choice for next time. */
export async function setFrequency(userId: string, f: Frequency): Promise<boolean> {
  if (f === 'off') return setWeekly(userId, false)
  try {
    const data = { weekly: true, daily: f === 'daily', unsubscribedAt: null }
    await prisma.emailPrefs.upsert({ where: { userId }, create: { userId, ...data }, update: data, select: KEY })
    return true
  } catch (error) {
    console.error('[email] frequency not saved:', (error as Error)?.message)
    return false
  }
}

/** Turns the weekly email on or off. Off from an unsubscribe link also stamps unsubscribedAt. */
export async function setWeekly(userId: string, on: boolean, via: 'settings' | 'unsubscribe' = 'settings'): Promise<boolean> {
  const data = { weekly: on, unsubscribedAt: on ? null : via === 'unsubscribe' ? new Date() : null }
  try {
    await prisma.emailPrefs.upsert({ where: { userId }, create: { userId, ...data }, update: data, select: KEY })
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
    await prisma.emailPrefs.upsert({ where: { userId }, create: { userId }, update: {}, select: KEY })
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
