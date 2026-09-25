import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdminEmail } from '@/lib/admin'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAdminEmail(session.user?.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        resumesCreated: true,
        createdAt: true,
        lastActiveAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const stats = {
      total: users.length,
      free: users.filter(u => u.plan === 'FREE').length,
      premium: users.filter(u => u.plan === 'PREMIUM').length,
      totalResumes: users.reduce((sum, u) => sum + u.resumesCreated, 0)
    }

    return NextResponse.json({ users, stats })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}