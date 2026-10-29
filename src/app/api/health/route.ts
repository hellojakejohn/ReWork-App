// GET /api/health (admins only): which keys are set, can we reach the DB, and does one
// tiny call succeed on every configured AI provider (Anthropic, OpenAI, OpenRouter).
// Each provider check says which failure it is (checks.ai.<provider>.kind: quota | auth |
// rate_limit | overloaded | ...), so an exhausted account or a bad key shows up here
// before users report "busy". `models` shows the routing in effect. `checks.stripePrices`
// fetches both configured Stripe prices and fails if either doesn't match plans.ts (or the
// key's mode); `checks.stripeWebhook` finds this deployment's endpoint and checks its events
// and API version. `checks.files` reads a tiny PDF and DOCX with the real extractors, so a
// library file missing from the bundle shows here instead of as failed uploads.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'
import { prisma } from '@/lib/prisma'
import type { AIErrorKind } from '@/lib/ai-errors'
import { checkProviders } from '@/lib/ai/health'
import { allRoutes, formatRoute, proAlwaysTopModel } from '@/lib/ai/routing'
import { aiCapRatio } from '@/lib/ai-cap-rules'
import { checkStripePrices, checkStripeWebhook, getStripe } from '@/lib/stripe'
import { OFFER_IDS, PRICING } from '@/lib/plans'
import { checkFileReading } from '@/lib/health-files'

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

export async function GET(request: Request) {
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
    stripePrices: set('STRIPE_PRICE_PRO_MONTHLY', 'STRIPE_PRICE_PASS'),
    auth: set('NEXTAUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'),
    cron: set('CRON_SECRET'),
  }

  const stripe = getStripe()
  const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin
  const [database, ai, stripePrices, stripeWebhook, files] = await Promise.all([
    timed(async () => {
      await prisma.$queryRaw`SELECT 1`
    }),
    checkProviders(),
    stripe ? checkStripePrices(stripe, OFFER_IDS.map((id) => PRICING[id])) : Promise.resolve(null),
    stripe ? checkStripeWebhook(stripe, baseUrl) : Promise.resolve(null),
    checkFileReading(),
  ])
  // A provider nothing routes to (an old key left set) can't break the app, so it can't fail health.
  const aiOk = Object.values(ai).every((c) => c.ok || !c.used)
  const pricesOk = !!stripePrices && Object.values(stripePrices).every((c) => c.ok)
  const routes = allRoutes()

  const filesOk = files.pdf.ok && files.docx.ok
  const ok = database.ok && filesOk && aiOk && keys.storage && keys.stripe && keys.stripeWebhook && keys.cron && pricesOk && !!stripeWebhook?.ok
  return NextResponse.json(
    {
      ok,
      keys,
      checks: { database, files, ai, stripePrices, stripeWebhook },
      models: Object.fromEntries(Object.entries(routes).map(([task, r]) => [task, r ? formatRoute(r) : null])),
      aiCap: { ratio: aiCapRatio(), proAlwaysTopModel: proAlwaysTopModel() },
      time: new Date().toISOString(),
    },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  )
}
