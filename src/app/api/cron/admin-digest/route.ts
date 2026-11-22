import { NextResponse } from 'next/server'
import { cronAuthorized } from '@/lib/cron-auth'
import { runAdminDigest } from '@/lib/email/admin-digest'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Daily at 14:45 UTC (vercel.json), after the job pull and the entitlement sweep.
// Off until EMAIL_ADMIN_DIGEST is dry or on.
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ ok: false }, { status: 401 })
  try {
    const result = await runAdminDigest()
    return NextResponse.json({ ok: result.status !== 'failed', result, at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 300) }, { status: 500 })
  }
}
