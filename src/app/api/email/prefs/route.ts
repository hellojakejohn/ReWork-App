// GET/PUT /api/email/prefs { frequency: off | weekly | daily } (or the older { weekly }).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { frequencyOf, getEmailPrefs, isFrequency, setFrequency, type Frequency } from '@/lib/email/prefs'
import { track } from '@/lib/track'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const prefs = await getEmailPrefs(session.user.id)
  if (!prefs) return NextResponse.json({ available: false })
  return NextResponse.json({ available: true, weekly: prefs.weekly, frequency: frequencyOf(prefs) })
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const frequency: Frequency | null = isFrequency(body?.frequency) ? body.frequency : typeof body?.weekly === 'boolean' ? (body.weekly ? 'weekly' : 'off') : null
  if (!frequency) return NextResponse.json({ error: 'frequency must be off, weekly or daily' }, { status: 400 })
  if (!(await setFrequency(session.user.id, frequency))) return NextResponse.json({ error: "We couldn't save that. Please try again." }, { status: 503 })
  await track('email_prefs', { weekly: frequency !== 'off', frequency, via: 'settings' }, session.user.id)
  return NextResponse.json({ ok: true, weekly: frequency !== 'off', frequency })
}
