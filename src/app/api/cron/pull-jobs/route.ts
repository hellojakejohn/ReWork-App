import { NextResponse } from 'next/server'
import { cronAuthorized } from '@/lib/cron-auth'
import { prisma } from '@/lib/prisma'
import { LIST_BOARDS } from '@/lib/feed/board-list'
import { closeStaleSearched, pullListBoards } from '@/lib/feed/sync'
import { pullAllSmartRecruiters } from '@/lib/feed/smartrecruiters'
import { track } from '@/lib/track'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Daily Vercel cron: refresh the shared jobs table from the full-list company boards
// (docs/job-feed-plan.md, chunk 2). Free: public board APIs, no model calls.
export async function GET(req: Request) {
  // Fail closed: without CRON_SECRET nobody can call this.
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  try {
    const [pulled, smartRecruiters] = await Promise.all([pullListBoards(prisma, LIST_BOARDS), pullAllSmartRecruiters(prisma)])
    const summary = {
      ...pulled,
      failed: [...pulled.failed, ...smartRecruiters.failed],
      listed: pulled.listed + smartRecruiters.listed,
      added: pulled.added + smartRecruiters.added,
      closed: pulled.closed + smartRecruiters.closed,
      staleClosed: await closeStaleSearched(prisma),
    }
    await track('feed_pull', { ...summary, failed: summary.failed.length })
    return NextResponse.json({ ok: true, summary, at: new Date().toISOString() })
  } catch (e) {
    // Before the jobs table exists (chunk 1 SQL not pasted) every board fails the same way.
    return NextResponse.json({ ok: false, error: String(e).slice(0, 300) }, { status: 500 })
  }
}
