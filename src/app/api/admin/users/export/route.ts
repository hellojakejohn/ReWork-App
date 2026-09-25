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

    // Create CSV content
    const csvHeaders = [
      'ID',
      'Name',
      'Email',
      'Plan',
      'Resumes Created',
      'Joined Date',
      'Last Active'
    ]

    const csvRows = users.map(user => [
      user.id,
      user.name || '',
      user.email,
      user.plan,
      user.resumesCreated.toString(),
      new Date(user.createdAt).toISOString().split('T')[0],
      new Date(user.lastActiveAt).toISOString().split('T')[0]
    ])

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="users-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error) {
    console.error('Error exporting users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}