// Product analytics (server only). One row per event in the `events` table; the admin
// page reads them. track() never throws and never blocks a user action on analytics:
// a failed insert is logged and dropped.
//
// Keep props to timings, counts, outcomes and token usage. No resume text, job text,
// names or emails.
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type EventName =
  | 'signed_up'
  | 'resume_parsed' // { ok, ms, source, kind? } + usage
  | 'job_fetched' // { ok, resolver | reason } + usage when the model read the page
  | 'tailored' // { ms, coverageBefore, coverageAfter, warnings } + usage
  | 'cover_letter_generated' // { ms, tone } + usage
  | 'evidence_completed' // { applied }
  | 'ai_usage' // model calls with no event of their own (evidence questions/rewrites)
  | 'ai_error' // { feature, kind, status }
  | 'checkout_started' // { offer }
  | 'checkout_completed' // { offer }
  | 'limit_hit' // { kind }
  | 'download' // { format, doc }
  | 'account_deleted'

export type EventProps = Record<string, string | number | boolean | null | undefined>

export async function track(name: EventName, props: EventProps = {}, userId?: string | null): Promise<void> {
  const clean: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue
    clean[key] = typeof value === 'number' && !Number.isFinite(value) ? null : value
  }
  try {
    await prisma.event.create({
      data: { name, userId: userId ?? null, props: clean as Prisma.InputJsonObject },
    })
  } catch (error) {
    console.error(`[track] dropped ${name}:`, (error as Error)?.message)
  }
}

/** Milliseconds since `start`, rounded. */
export const msSince = (start: number) => Math.round(Date.now() - start)
