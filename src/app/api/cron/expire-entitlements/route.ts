import { NextResponse } from 'next/server'
import { expireEntitlements } from '@/lib/entitlements'

export const dynamic = 'force-dynamic'

// Daily Vercel cron: marks entitlements whose endsAt passed as EXPIRED and refreshes User.plan.
// getAccess() already ignores expired rows, so this is bookkeeping, not enforcement.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  try {
    const result = await expireEntitlements()
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
