// GET -> where the signed-in user stands against this period's AI cap: a percent, the
// band, the reset date and the banner line. Never dollars (src/lib/ai-cap.ts usageDTO).
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCapState, usageDTO } from '@/lib/ai-cap'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const state = await getCapState(session.user.id)
  return NextResponse.json(usageDTO(state), { headers: { 'Cache-Control': 'no-store' } })
}
