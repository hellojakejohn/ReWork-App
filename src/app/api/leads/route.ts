// POST { email, source: check | fit, missing?, website? } -> { ok: true }. The optional email
// card under the free /check and /fit results (src/lib/leads.ts). No account needed. The
// answer never says whether the email was already on the list. `website` is a honeypot.
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { track } from '@/lib/track'
import { SOURCE_COOKIE } from '@/lib/signup-source'
import { leadInput } from '@/lib/leads-shared'
import { leadContext, saveLead, sendLeadEmail } from '@/lib/leads'

export const runtime = 'nodejs'
export const maxDuration = 30

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status })

function visitorKey(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  return `lead:${ip}`
}

export async function POST(request: NextRequest) {
  if (!checkRateLimit(visitorKey(request)).allowed) return fail('Easy there. Try again in a few minutes.', 429)
  const body = await request.json().catch(() => null)
  const parsed = leadInput.safeParse(body)
  if (!parsed.success) return fail('That email doesn’t look right. Check it and try again.')
  const { email, source, missing, website } = parsed.data
  // A bot filled the hidden field: answer like it worked, keep nothing.
  if (website && website.trim()) return NextResponse.json({ ok: true })

  const ctx = leadContext(request.cookies.get(SOURCE_COOKIE)?.value)
  try {
    const saved = await saveLead(email, source, ctx)
    if (saved.created) {
      await track('lead_captured', { source, ref: ctx.ref })
      await sendLeadEmail({ id: saved.id, email, source, missing })
    }
  } catch (error) {
    console.error('[leads] save failed:', (error as Error)?.message)
    return fail("We couldn't save that right now. Please try again later.", 503)
  }
  return NextResponse.json({ ok: true })
}
