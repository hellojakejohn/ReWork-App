import { NextResponse } from 'next/server'
import { cronAuthorized } from '@/lib/cron-auth'
import { runWeekly } from '@/lib/email/weekly'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Mondays from 13:00 UTC, every 20 minutes until 16:40 (vercel.json): each pass sends to
// whoever is left. Off until EMAIL_WEEKLY is dry, admins or live (src/lib/email/config.ts).
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ ok: false }, { status: 401 })
  try {
    const summary = await runWeekly({ deadline: Date.now() + 270_000 })
    return NextResponse.json({ ok: true, summary, at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 300) }, { status: 500 })
  }
}
