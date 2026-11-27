// POST /api/leads/unsubscribe?t=<token>: one click, no sign-in, for free-tool leads
// (src/lib/leads.ts). Mail apps POST here from their own unsubscribe button (RFC 8058);
// the /unsubscribe/lead page's button posts here too. Exempt from the proxy's Origin check.
import { NextRequest, NextResponse } from 'next/server'
import { readLeadUnsubscribeToken } from '@/lib/email/unsubscribe'
import { unsubscribeLead } from '@/lib/leads'
import { track } from '@/lib/track'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  let token = request.nextUrl.searchParams.get('t')
  if (!token) {
    const form = await request.formData().catch(() => null)
    const t = form?.get('t')
    token = typeof t === 'string' ? t : null
  }
  const leadId = readLeadUnsubscribeToken(token)
  if (!leadId) return NextResponse.json({ ok: false, error: 'That unsubscribe link is not valid.' }, { status: 400 })
  try {
    const res = await unsubscribeLead(leadId)
    // A lead already gone still counts as unsubscribed: nothing will be sent.
    if (res.ok) await track('lead_unsubscribed', { source: res.source })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[leads] unsubscribe failed:', (error as Error)?.message)
    return NextResponse.json({ ok: false, error: "We couldn't save that. Please try again, or email support@rework.careers." }, { status: 503 })
  }
}
