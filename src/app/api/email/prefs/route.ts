// GET/PUT /api/email/prefs { weekly }: the signed-in user's email settings.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEmailPrefs, setWeekly } from '@/lib/email/prefs'
import { track } from '@/lib/track'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const prefs = await getEmailPrefs(session.user.id)
  if (!prefs) return NextResponse.json({ available: false })
  return NextResponse.json({ available: true, weekly: prefs.weekly })
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (typeof body?.weekly !== 'boolean') return NextResponse.json({ error: 'weekly must be true or false' }, { status: 400 })
  if (!(await setWeekly(session.user.id, body.weekly))) return NextResponse.json({ error: "We couldn't save that. Please try again." }, { status: 503 })
  await track('email_prefs', { weekly: body.weekly, via: 'settings' }, session.user.id)
  return NextResponse.json({ ok: true, weekly: body.weekly })
}
