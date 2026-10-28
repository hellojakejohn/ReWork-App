// GET /api/health (admins only): which keys are set, can we reach the DB, and does one
// tiny call succeed on every configured AI provider (Anthropic, OpenAI, OpenRouter).
// Each provider check says which failure it is (checks.ai.<provider>.kind: quota | auth |
// rate_limit | overloaded | ...), so an exhausted account or a bad key shows up here
// before users report "busy". `models` shows the routing in effect.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'
import { prisma } from '@/lib/prisma'
import type { AIErrorKind } from '@/lib/ai-errors'
import { checkProviders } from '@/lib/ai/health'
import { allRoutes, formatRoute, proAlwaysTopModel } from '@/lib/ai/routing'
import { aiCapRatio } from '@/lib/ai-cap-rules'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const set = (...names: string[]) => names.every((n) => !!process.env[n]?.trim())

interface Check {
  ok: boolean
  ms?: number
  detail?: string
  kind?: AIErrorKind
}

async function timed(fn: () => Promise<string | void>): Promise<Check> {
  const start = Date.now()
  try {
    const detail = await fn()
    return { ok: true, ms: Date.now() - start, ...(detail ? { detail } : {}) }
  } catch (error) {
    return { ok: false, ms: Date.now() - start, detail: String((error as Error)?.message || error).slice(0, 300) }
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const keys = {
    anthropic: set('ANTHROPIC_API_KEY'),
    openai: set('OPENAI_API_KEY'),
    openrouter: set('OPENROUTER_API_KEY'),
    database: set('DATABASE_URL'),
    storage: set('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'),
    stripe: set('STRIPE_SECRET_KEY'),
    stripeWebhook: set('STRIPE_WEBHOOK_SECRET'),
    stripePrices: set('STRIPE_PRICE_PRO_MONTHLY') && (set('STRIPE_PRICE_PASS') || set('STRIPE_PRICE_PASS_30D')),
    auth: set('NEXTAUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'),
    cron: set('CRON_SECRET'),
  }

  const [database, ai] = await Promise.all([
    timed(async () => {
      await prisma.$queryRaw`SELECT 1`
    }),
    checkProviders(),
  ])
  const aiOk = Object.values(ai).every((c) => c.ok)
  const routes = allRoutes()

  const ok = database.ok && aiOk && keys.storage && keys.stripe
  return NextResponse.json(
    {
      ok,
      keys,
      checks: { database, ai },
      models: Object.fromEntries(Object.entries(routes).map(([task, r]) => [task, r ? formatRoute(r) : null])),
      aiCap: { ratio: aiCapRatio(), proAlwaysTopModel: proAlwaysTopModel() },
      time: new Date().toISOString(),
    },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  )
}
