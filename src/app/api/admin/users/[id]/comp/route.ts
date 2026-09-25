import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdminEmail } from '@/lib/admin'
import { grantComp } from '@/lib/entitlements'

// POST { days } -> creates a COMP entitlement (stacks onto an existing comp).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdminEmail(session.user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const days = Number(body?.days)
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    return NextResponse.json({ error: 'days must be a whole number from 1 to 3650' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const access = await grantComp(user.id, days)
  console.log(`[admin] ${session.user?.email} comped ${days}d Pro to user ${user.id}`)
  return NextResponse.json({ access })
}
