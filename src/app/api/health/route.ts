// GET /api/health (admins only): which keys are set, can we reach the DB, and does one
// cheap OpenAI call succeed. The OpenAI check says which failure it is
// (checks.openai.kind: quota | auth | rate_limit | ...), so an exhausted account or a bad
// key shows up here before users report "busy".
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'
import { prisma } from '@/lib/prisma'
import { getOpenAI } from '@/lib/openai'
import { classifyAIError, errorCodes, type AIErrorKind } from '@/lib/ai-errors'
import { parseModel } from '@/lib/parse-resume'
import { tailorModel } from '@/lib/tailor'
import { jobExtractModel } from '@/lib/job-resolve/model-extract'

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
    openai: set('OPENAI_API_KEY'),
    database: set('DATABASE_URL'),
    storage: set('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'),
    stripe: set('STRIPE_SECRET_KEY'),
    stripeWebhook: set('STRIPE_WEBHOOK_SECRET'),
    stripePrices: set('STRIPE_PRICE_PRO_MONTHLY', 'STRIPE_PRICE_PASS_30D'),
    auth: set('NEXTAUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'),
    cron: set('CRON_SECRET'),
  }

  const [database, openai] = await Promise.all([
    timed(async () => {
      await prisma.$queryRaw`SELECT 1`
    }),
    keys.openai
      ? (async (): Promise<Check> => {
          const start = Date.now()
          try {
            const res = await getOpenAI().chat.completions.create({
              model: 'gpt-4o-mini',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'ping' }],
            })
            return { ok: true, ms: Date.now() - start, detail: res.model }
          } catch (error) {
            const classified = classifyAIError(error, 'Health check')
            const codes = errorCodes(error)
            return {
              ok: false,
              ms: Date.now() - start,
              kind: classified.kind,
              detail: `${classified.kind}${codes.length ? ` (${[...new Set(codes)].join(', ')})` : ''}: ${String((error as Error)?.message || '').slice(0, 200)}`,
            }
          }
        })()
      : Promise.resolve<Check>({ ok: false, kind: 'not_configured', detail: 'OPENAI_API_KEY is not set' }),
  ])

  const ok = database.ok && openai.ok && keys.storage && keys.stripe
  return NextResponse.json(
    {
      ok,
      keys,
      checks: { database, openai },
      models: { parse: parseModel(), tailor: tailorModel(), jobExtract: jobExtractModel() },
      time: new Date().toISOString(),
    },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  )
}
