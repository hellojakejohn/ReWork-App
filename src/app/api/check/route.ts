// POST { job } -> the free "Is this job real?" check (src/lib/job-check.ts). Public: no
// account, no AI call, nothing saved. Links are read through the same safe fetcher as the
// Job card (LinkedIn never fetched; blocked sites ask for the text instead).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import { track } from '@/lib/track'
import { INPUT_LIMITS } from '@/lib/plans'
import { checkJob } from '@/lib/job-check'
import { fetchJobPage } from '@/lib/job-resolve/fetch-page'

export const runtime = 'nodejs'
export const maxDuration = 30

const fail = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ success: false, error, ...extra }, { status })

function visitorKey(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  return `check:${ip}`
}

export async function POST(request: NextRequest) {
  if (!checkRateLimit(visitorKey(request)).allowed) return fail('Easy there. Try again in a few minutes.', 429)
  const body = await request.json().catch(() => null)
  const raw = typeof body?.job === 'string' ? body.job.slice(0, INPUT_LIMITS.jobDescriptionChars) : ''
  if (raw.trim().length < 8) return fail('Paste a job link or the whole job post.')

  const outcome = await checkJob(raw, {
    fetchPage: fetchJobPage,
    findBoardJob: (source, jobId) =>
      prisma.job.findFirst({ where: { source, id: { endsWith: `:${jobId}` } }, select: { company: true, firstSeenAt: true, closedAt: true } }),
    countCompanyOpen: (company) => prisma.job.count({ where: { company, closedAt: null } }),
  })
  if (!outcome.ok) {
    await track('job_check_public', { ok: false, needsPaste: !!outcome.needsPaste })
    return fail(outcome.error, 422, { needsPaste: !!outcome.needsPaste })
  }
  const r = outcome.result
  await track('job_check_public', {
    ok: true,
    link: r.fromLink,
    scam: r.scam.map((s) => s.id).join(','),
    ghost: r.ghost.map((g) => g.id).join(','),
    onBoard: r.board ? (r.board.open ? 'open' : 'closed') : 'unknown',
  })
  return NextResponse.json({ success: true, result: r })
}
