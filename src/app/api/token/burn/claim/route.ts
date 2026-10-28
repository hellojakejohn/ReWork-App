// POST { signature } -> grants Pro for a finalized burn made from this account's quote.
// 202 while the transaction isn't finalized yet; the client retries.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BurnError, claimBurn } from '@/lib/token-burn'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  try {
    const result = await claimBurn(session.user.id, body?.signature)
    return NextResponse.json(result, { status: result.status === 'pending' ? 202 : 200, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof BurnError) return NextResponse.json({ error: error.message }, { status: error.status })
    throw error
  }
}
