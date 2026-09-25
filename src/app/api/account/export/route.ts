// GET -> a JSON file of everything we store for the signed-in user.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { exportAccountData } from '@/lib/account'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const data = await exportAccountData(session.user.id)
  if (!data) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="rework-data-${date}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
