import { NextResponse } from 'next/server'
import { cronAuthorized } from '@/lib/cron-auth'
import { prisma } from '@/lib/prisma'
import { LIST_BOARDS } from '@/lib/feed/board-list'
import { closeStaleSearched, pullListBoards } from '@/lib/feed/sync'
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
    const pulled = await pullListBoards(prisma, LIST_BOARDS)
    const summary = { ...pulled, staleClosed: await closeStaleSearched(prisma) }
    await track('feed_pull', { ...summary, failed: summary.failed.length })
    return NextResponse.json({ ok: true, summary, at: new Date().toISOString() })
  } catch (e) {
    // Before the jobs table exists (chunk 1 SQL not pasted) every board fails the same way.
    return NextResponse.json({ ok: false, error: String(e).slice(0, 300) }, { status: 500 })
  }
}
