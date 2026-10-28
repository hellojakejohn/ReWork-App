// POST { wallet } -> a priced, unsigned burn transaction for 30 days of Pro (src/lib/token-burn.ts).
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BurnError, createBurnQuote } from '@/lib/token-burn'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  try {
    return NextResponse.json(await createBurnQuote(session.user.id, body?.wallet), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof BurnError) return NextResponse.json({ error: error.message }, { status: error.status })
    throw error
  }
}
