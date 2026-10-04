import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdminEmail } from '@/lib/admin'
import { getCapState, setCapOverride, usageDTO } from '@/lib/ai-cap'

// POST { capUsd: number | null } -> set or clear this user's AI cap override (USD per cap
// period). null goes back to AI_CAP_RATIO x net revenue.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdminEmail(session.user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const raw = body?.capUsd
  const capUsd = raw === null ? null : Number(raw)
  if (capUsd !== null && (!Number.isFinite(capUsd) || capUsd < 0 || capUsd > 1000)) {
    return NextResponse.json({ error: 'capUsd must be a number from 0 to 1000, or null to clear' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    await setCapOverride(user.id, capUsd, typeof body?.note === 'string' ? body.note.slice(0, 200) : undefined)
  } catch (error) {
    console.error('[admin] cap override failed (is the ai_cap_overrides migration applied?):', (error as Error)?.message)
    return NextResponse.json({ error: 'Could not save. Apply the ai_cap_overrides migration first.' }, { status: 500 })
  }
  console.log(`[admin] ${session.user?.email} set AI cap override for ${user.id} to ${capUsd === null ? 'default' : `$${capUsd}`}`)
  return NextResponse.json({ usage: usageDTO(await getCapState(user.id)) })
}
