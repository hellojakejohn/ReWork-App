import { NextResponse } from 'next/server'
import { cronAuthorized } from '@/lib/cron-auth'
import { runWeekly } from '@/lib/email/weekly'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// The daily brief: every morning from 13:00 UTC (after the 12:30 job pull), three passes
// 20 minutes apart (vercel.json). Only people who chose daily; same EMAIL_WEEKLY switch.
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ ok: false }, { status: 401 })
  try {
    const summary = await runWeekly({ deadline: Date.now() + 270_000, cadence: 'daily' })
    return NextResponse.json({ ok: true, summary, at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 300) }, { status: 500 })
  }
}
