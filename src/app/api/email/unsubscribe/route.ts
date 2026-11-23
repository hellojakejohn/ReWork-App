// POST /api/email/unsubscribe?t=<token>: one click, no sign-in. Gmail and Apple Mail POST
// here from their own unsubscribe button (List-Unsubscribe-Post, RFC 8058); the
// /unsubscribe page's button posts here too. Exempt from the proxy's Origin check (src/proxy.ts).
import { NextRequest, NextResponse } from 'next/server'
import { readUnsubscribeToken } from '@/lib/email/unsubscribe'
import { setWeekly } from '@/lib/email/prefs'
import { track } from '@/lib/track'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  let token = request.nextUrl.searchParams.get('t')
  if (!token) {
    const form = await request.formData().catch(() => null)
    const t = form?.get('t')
    token = typeof t === 'string' ? t : null
  }
  const userId = readUnsubscribeToken(token)
  if (!userId) return NextResponse.json({ ok: false, error: 'That unsubscribe link is not valid.' }, { status: 400 })
  const saved = await setWeekly(userId, false, 'unsubscribe')
  if (!saved) return NextResponse.json({ ok: false, error: "We couldn't save that. Please try again, or email support@rework.careers." }, { status: 503 })
  await track('email_prefs', { weekly: false, via: 'unsubscribe' }, userId)
  return NextResponse.json({ ok: true })
}
