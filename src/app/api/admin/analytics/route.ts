// GET ?days=7|30 -> AnalyticsReport (admins only). See src/lib/admin-analytics.ts.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'
import { analyticsReport, isWindowDays } from '@/lib/admin-analytics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdminEmail(session.user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const requested = Number(request.nextUrl.searchParams.get('days') ?? 7)
  const days = isWindowDays(requested) ? requested : 7
  try {
    return NextResponse.json(await analyticsReport(days))
  } catch (error) {
    console.error('[admin/analytics] failed:', error)
    const missingTable = /relation "events" does not exist|P2021/.test(String((error as Error)?.message ?? error))
    return NextResponse.json(
      { error: missingTable ? 'The events table is missing. Run migration 20260930000000_events.' : 'Could not load analytics.' },
      { status: 500 }
    )
  }
}
