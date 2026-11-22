// The daily admin digest: one short email to the admins with yesterday's numbers and
// anything that needs a look (errors, a stale or failing job pull, AI spend, DB size).
// Off until EMAIL_ADMIN_DIGEST is set:
//   off (default) | dry (log what would be sent, send nothing) | on (send to ADMIN_EMAILS)
// Server only. Counts come from the events, entitlements and jobs tables; no user names,
// emails or resume text in the email.
import { prisma } from '@/lib/prisma'
import { getAdminEmails } from '@/lib/admin'
import { SITE_URL } from '@/lib/site'
import { track } from '@/lib/track'
import { esc } from './templates'
import { sendEmail } from './send'

export type DigestMode = 'off' | 'dry' | 'on'
const DAY = 86_400_000

export function digestMode(): DigestMode {
  const m = (process.env.EMAIL_ADMIN_DIGEST?.trim() || '').toLowerCase()
  return m === 'dry' || m === 'on' ? m : 'off'
}

export interface DigestData {
  /** The UTC day the numbers cover, YYYY-MM-DD. */
  day: string
  signups: number
  signupsBySource: { source: string; n: number }[]
  parsed: number
  tailored: number
  coverLetters: number
  matchRuns: number
  checkouts: number
  paid: number
  publicFit: number
  publicCheck: number
  errors: number
  topErrors: { what: string; n: number }[]
  aiUsd: number
  proActive: number
  openJobs: number
  pull: { at: string; ok: number; boards: number; failed: number; added: number; closed: number; usajobs: number | null; failedBoards: string | null } | null
  dbMb: number | null
  /** Seven days ago, for a "vs last week" signups line. */
  signups7d: number
}

/** What needs a look, worst first. Pure. */
export function digestAlerts(d: DigestData, now: Date): string[] {
  const out: string[] = []
  if (!d.pull) out.push('No job pull on record.')
  else {
    const ageH = (now.getTime() - new Date(d.pull.at).getTime()) / 3_600_000
    if (ageH > 26) out.push(`Last job pull was ${Math.round(ageH)} hours ago (the cron runs daily at 12:30 UTC).`)
    if (d.pull.failed > 3) out.push(`${d.pull.failed} job boards failed in the last pull.`)
  }
  if (d.errors >= 10) out.push(`${d.errors} errors yesterday.`)
  if (d.aiUsd >= 10) out.push(`AI spend was $${d.aiUsd.toFixed(2)} yesterday.`)
  if (d.dbMb !== null && d.dbMb >= 400) out.push(`Database is ${d.dbMb} MB of the 500 MB free tier.`)
  return out
}

const n = (x: number) => x.toLocaleString('en-US')

export function digestSubject(d: DigestData, alerts: number): string {
  const head = `ReWork ${d.day}: ${d.signups} ${d.signups === 1 ? 'signup' : 'signups'}, ${d.tailored} ${d.tailored === 1 ? 'tailor' : 'tailors'}`
  const money = d.paid > 0 ? `, ${d.paid} paid` : ''
  return `${head}${money}${alerts ? ` (${alerts} to check)` : ''}`
}

/** Rows of [label, value] for the email body. Pure. */
export function digestRows(d: DigestData): [string, string][] {
  const sources = d.signupsBySource.map((s) => `${s.source} ${s.n}`).join(', ')
  const rows: [string, string][] = [
    ['Signups', `${d.signups}${sources ? ` (${sources})` : ''}; ${d.signups7d} in the last 7 days`],
    ['Resumes parsed', n(d.parsed)],
    ['Tailors', n(d.tailored)],
    ['Cover letters', n(d.coverLetters)],
    ['Match runs', n(d.matchRuns)],
    ['Free tools', `${d.publicFit} fit checks, ${d.publicCheck} job checks`],
    ['Checkouts', `${d.checkouts} started, ${d.paid} paid`],
    ['Pro now', n(d.proActive)],
    ['AI spend', `$${d.aiUsd.toFixed(2)}`],
    ['Errors', d.errors ? `${d.errors} (${d.topErrors.map((e) => `${e.what} ${e.n}`).join(', ')})` : '0'],
    ['Open jobs', n(d.openJobs)],
  ]
  if (d.pull) {
    const fed = d.pull.usajobs !== null ? `, ${n(d.pull.usajobs)} federal` : ''
    rows.push(['Last pull', `${d.pull.ok}/${d.pull.boards} boards ok, ${n(d.pull.added)} added, ${n(d.pull.closed)} closed${fed}`])
    if (d.pull.failedBoards) rows.push(['Failed boards', d.pull.failedBoards])
  }
  if (d.dbMb !== null) rows.push(['Database', `${d.dbMb} MB of 500`])
  return rows
}

export function digestEmail(d: DigestData, now: Date): { subject: string; html: string; text: string } {
  const alerts = digestAlerts(d, now)
  const rows = digestRows(d)
  const adminUrl = `${SITE_URL}/admin`
  const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
  const alertHtml = alerts.length
    ? `<p style="margin:0 0 12px;font-weight:600;color:#C23D22;">Check:</p><ul style="margin:0 0 16px;padding-left:18px;color:#C23D22;">${alerts.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`
    : `<p style="margin:0 0 16px;color:#4F6656;">Nothing needs a look.</p>`
  const table = rows
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6C7F72;white-space:nowrap;vertical-align:top;">${esc(k)}</td><td style="padding:4px 0;color:#17301F;">${esc(v)}</td></tr>`)
    .join('')
  const html = `<!doctype html><html><body style="margin:0;padding:20px;background:#FBFAF7;font-family:${sans};font-size:14px;line-height:20px;">
<div style="max-width:560px;">
<p style="margin:0 0 12px;font-size:18px;color:#17301F;">ReWork, ${esc(d.day)} (UTC)</p>
${alertHtml}
<table role="presentation" cellpadding="0" cellspacing="0">${table}</table>
<p style="margin:16px 0 0;"><a href="${esc(adminUrl)}" style="color:#17301F;">Open /admin</a></p>
<p style="margin:16px 0 0;font-size:12px;color:#6C7F72;">Admin-only digest. Turn it off with EMAIL_ADMIN_DIGEST=off.</p>
</div></body></html>`
  const text = [
    `ReWork, ${d.day} (UTC)`,
    '',
    alerts.length ? ['Check:', ...alerts.map((a) => `- ${a}`)].join('\n') : 'Nothing needs a look.',
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    `Open /admin: ${adminUrl}`,
  ].join('\n')
  return { subject: digestSubject(d, alerts.length), html, text }
}

/** Yesterday (UTC) in numbers. */
export async function gatherDigest(now = new Date()): Promise<DigestData> {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const start = new Date(end.getTime() - DAY)
  const window = { createdAt: { gte: start, lt: end } }
  const [grouped, signupRows, signups7d, errorRows, spend, active, openJobs, lastPull, db] = await Promise.all([
    prisma.event.groupBy({ by: ['name'], where: window, _count: { _all: true } }),
    prisma.event.findMany({ where: { name: 'signed_up', ...window }, select: { props: true } }),
    prisma.event.count({ where: { name: 'signed_up', createdAt: { gte: new Date(end.getTime() - 7 * DAY), lt: end } } }),
    prisma.event.findMany({
      where: { ...window, OR: [{ name: 'ai_error' }, { name: 'server_error' }, { name: 'resume_parsed', props: { path: ['ok'], equals: false } }] },
      select: { name: true, props: true },
      take: 2000,
    }),
    prisma.$queryRaw<{ usd: number }[]>`SELECT COALESCE(SUM((props->>'costUsd')::numeric), 0)::float8 AS usd FROM "events" WHERE "createdAt" >= ${start} AND "createdAt" < ${end} AND props->>'costUsd' IS NOT NULL`,
    prisma.entitlement.findMany({
      where: { status: { in: ['ACTIVE', 'PAST_DUE'] }, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      select: { userId: true },
    }),
    prisma.job.count({ where: { closedAt: null } }).catch(() => 0),
    prisma.event.findFirst({ where: { name: 'feed_pull' }, orderBy: { createdAt: 'desc' }, select: { props: true, createdAt: true } }),
    prisma.$queryRaw<{ mb: number }[]>`SELECT (pg_database_size(current_database()) / 1048576)::float8 AS mb`.catch(() => []),
  ])
  const count = (name: string) => grouped.find((g) => g.name === name)?._count._all ?? 0
  const bySource = new Map<string, number>()
  for (const r of signupRows) {
    const s = (r.props as Record<string, unknown> | null)?.source
    const key = typeof s === 'string' && s ? s : 'unknown'
    bySource.set(key, (bySource.get(key) ?? 0) + 1)
  }
  const errs = new Map<string, number>()
  for (const e of errorRows) {
    const p = (e.props ?? {}) as Record<string, unknown>
    const what = e.name === 'resume_parsed' ? 'parse' : `${String(p.feature ?? 'unknown')}:${String(p.kind ?? 'unknown')}`
    errs.set(what, (errs.get(what) ?? 0) + 1)
  }
  const p = (lastPull?.props ?? {}) as Record<string, unknown>
  const num = (v: unknown) => (typeof v === 'number' ? v : 0)
  return {
    day: start.toISOString().slice(0, 10),
    signups: signupRows.length,
    signupsBySource: [...bySource].map(([source, n]) => ({ source, n })).sort((a, b) => b.n - a.n),
    parsed: count('resume_parsed'),
    tailored: count('tailored'),
    coverLetters: count('cover_letter_generated'),
    matchRuns: count('feed_match'),
    checkouts: count('checkout_started'),
    paid: count('checkout_completed'),
    publicFit: count('fit_check_public'),
    publicCheck: count('job_check_public'),
    errors: errorRows.length,
    topErrors: [...errs].map(([what, n]) => ({ what, n })).sort((a, b) => b.n - a.n).slice(0, 3),
    aiUsd: Math.round(Number(spend[0]?.usd ?? 0) * 100) / 100,
    proActive: new Set(active.map((e) => e.userId)).size,
    openJobs,
    pull: lastPull
      ? {
          at: lastPull.createdAt.toISOString(),
          ok: num(p.ok),
          boards: num(p.boards),
          failed: num(p.failed),
          added: num(p.added),
          closed: num(p.closed),
          usajobs: typeof p.usajobs === 'number' ? p.usajobs : null,
          failedBoards: typeof p.failedBoards === 'string' && p.failedBoards ? p.failedBoards : null,
        }
      : null,
    dbMb: db[0] ? Math.round(db[0].mb) : null,
    signups7d,
  }
}

export interface DigestResult {
  mode: DigestMode
  status: 'off' | 'already_sent' | 'dry' | 'sent' | 'failed'
  to?: number
  error?: string
}

/** One daily run. Sends at most once per UTC day (checked against admin_digest events). */
export async function runAdminDigest({ now = new Date(), mode = digestMode(), send = sendEmail }: { now?: Date; mode?: DigestMode; send?: typeof sendEmail } = {}): Promise<DigestResult> {
  if (mode === 'off') return { mode, status: 'off' }
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  if (mode === 'on') {
    const already = await prisma.event.findFirst({ where: { name: 'admin_digest', createdAt: { gte: today }, props: { path: ['status'], equals: 'sent' } }, select: { id: true } })
    if (already) return { mode, status: 'already_sent' }
  }
  const data = await gatherDigest(now)
  const mail = digestEmail(data, now)
  const alerts = digestAlerts(data, now).length
  if (mode === 'dry') {
    await track('admin_digest', { status: 'dry', alerts, signups: data.signups, tailored: data.tailored })
    return { mode, status: 'dry' }
  }
  const to = getAdminEmails()
  const errors: string[] = []
  for (const addr of to) {
    const res = await send({ to: addr, subject: mail.subject, html: mail.html, text: mail.text, tag: 'admin_digest' })
    if (!res.ok) errors.push(res.error)
  }
  const ok = errors.length < to.length
  await track('admin_digest', { status: ok ? 'sent' : 'failed', alerts, to: to.length - errors.length, error: errors[0]?.slice(0, 200) })
  return ok ? { mode, status: 'sent', to: to.length - errors.length } : { mode, status: 'failed', error: errors[0] }
}
