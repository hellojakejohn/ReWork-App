// GET -> the application kit for the job the user last pressed Apply on (within 3 hours), for
// the Save to ReWork extension to fill the form on the page they have open. Signed-in only;
// the extension sends the user's own ReWork cookie (host permission for this site only).
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { latestApplyPacket } from '@/lib/apply-packet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const packet = await latestApplyPacket(session.user.id)
  return NextResponse.json({ success: true, packet }, { headers: { 'Cache-Control': 'no-store' } })
}
