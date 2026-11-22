// Admins only. GET ?kind=weekly|welcome -> the email as HTML, built from the admin's own
// account (weekly: their newest matches from the last 30 days, else sample jobs).
// POST { kind } -> sends that email to the admin's own address (needs Resend set up).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'
import { prisma } from '@/lib/prisma'
import { SITE_URL } from '@/lib/site'
import { sendBlocker } from '@/lib/email/config'
import { sendEmail } from '@/lib/email/send'
import { weeklyEmail, type EmailContent } from '@/lib/email/templates'
import { WEEKLY_WHY, buildWeekly, footerFor } from '@/lib/email/weekly'
import { buildWelcome } from '@/lib/email/welcome'
import { firstName } from '@/lib/email/weekly-rules'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function admin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !isAdminEmail(session.user.email)) return null
  return { id: session.user.id, email: session.user.email!, name: session.user.name ?? null }
}

const SAMPLE_JOBS = [
  { title: 'Operations Coordinator', company: 'Sample Co', location: 'Saint Paul, MN', remote: false, payLabel: '$55k to $65k', score: 62, reach: 74, present: ['Scheduling', 'Inventory', 'Vendor management'] },
  { title: 'Customer Success Manager', company: 'Example Inc', location: '', remote: true, payLabel: null, score: 48, reach: 51, present: ['Customer service', 'Training'] },
]

async function build(kind: string, me: NonNullable<Awaited<ReturnType<typeof admin>>>): Promise<EmailContent> {
  if (kind === 'welcome') return buildWelcome(me.id, me.name)
  const prefs = await prisma.feedPrefs.findFirst({ where: { userId: me.id, resume: { isActive: true } }, orderBy: { updatedAt: 'desc' } })
  if (prefs) {
    const built = await buildWeekly(me.id, prefs.resumeId, me.name, new Date(Date.now() - 30 * 86_400_000))
    if (built) return built.content
  }
  return weeklyEmail(
    {
      firstName: firstName(me.name),
      jobs: SAMPLE_JOBS.map((j) => ({ ...j, tailorUrl: `${SITE_URL}/dashboard` })),
      checked: await prisma.job.count({ where: { closedAt: null } }).catch(() => 33_000),
      followUpsDue: 2,
      trackerUrl: `${SITE_URL}/dashboard/tracker`,
      dashboardUrl: `${SITE_URL}/dashboard`,
    },
    footerFor(me.id, WEEKLY_WHY)
  )
}

export async function GET(request: NextRequest) {
  const me = await admin()
  if (!me) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const kind = request.nextUrl.searchParams.get('kind') === 'welcome' ? 'welcome' : 'weekly'
  const content = await build(kind, me)
  if (request.nextUrl.searchParams.get('format') === 'text') return new NextResponse(content.text, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
  return new NextResponse(content.html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

export async function POST(request: NextRequest) {
  const me = await admin()
  if (!me) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const blocked = sendBlocker()
  if (blocked) return NextResponse.json({ ok: false, error: blocked }, { status: 503 })
  const body = await request.json().catch(() => ({}))
  const kind = body?.kind === 'welcome' ? 'welcome' : 'weekly'
  const content = await build(kind, me)
  const res = await sendEmail({ to: me.email, subject: `[Test] ${content.subject}`, html: content.html, text: content.text, unsubscribeUrl: footerFor(me.id, WEEKLY_WHY).unsubscribeUrl, tag: 'test' })
  return NextResponse.json(res, { status: res.ok ? 200 : 502 })
}
