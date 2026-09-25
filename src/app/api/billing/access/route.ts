import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAccess } from '@/lib/entitlements'

export const dynamic = 'force-dynamic'

// GET -> Access for the signed-in user. Polled after checkout while the webhook lands.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ access: await getAccess(session.user.id) })
}
