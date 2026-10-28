import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Daily Vercel cron pings this so the free Supabase DB never pauses.
export async function GET(req: Request) {
  // Fail closed: without CRON_SECRET nobody can call this.
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
