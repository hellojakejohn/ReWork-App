import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Public liveness check for an uptime monitor: is the app up and can it reach the
// database? Says nothing else. The detailed check is /api/health (admins only).
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
