// POST { accepted: EvidenceRewrite[] } -> writes the accepted rewrites into the MASTER.
// Each one is re-checked against the answers stored for that bullet, so only text the
// fact guard passed with the user's own answers can land here.
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { masterToParsed, parsedToMaster } from '@/lib/master-resume'
import { toMasterDTO } from '@/lib/master-dto'
import { applyRewrites, candidateForBullet, guardRewrite, isNonAnswer, readStoredEvidence, type EvidenceRewrite } from '@/lib/evidence'
import { normalizeSpace } from '@/lib/resume-text'
import { evidenceContext } from '../shared'

export const runtime = 'nodejs'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await evidenceContext(id)
  if ('error' in ctx) return ctx.error

  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.accepted)) {
    return NextResponse.json({ error: 'accepted is required' }, { status: 400 })
  }

  const resume = masterToParsed(ctx.resume)
  const stored = readStoredEvidence(ctx.resume.evidence).answers
  const same = (a: string, b: string) => normalizeSpace(a).toLowerCase() === normalizeSpace(b).toLowerCase()

  const checked: EvidenceRewrite[] = []
  for (const r of body.accepted as EvidenceRewrite[]) {
    if (!r || typeof r.before !== 'string' || typeof r.after !== 'string' || typeof r.entryId !== 'string') continue
    const item = candidateForBullet(resume, r.entryId, r.before)
    if (!item) continue
    const answers = stored.filter((a) => same(a.bullet, r.before) && !isNonAnswer(a.answer))
    const guarded = guardRewrite({ ...item, weakness: '', questions: [] }, answers, r.after)
    if (!guarded.ok) continue
    checked.push({ ...r, section: item.section, index: item.index, after: guarded.text })
  }

  const { resume: next, applied } = applyRewrites(resume, checked)
  if (applied === 0) {
    return NextResponse.json({ success: true, applied: 0, master: toMasterDTO(ctx.resume) })
  }
  const master = parsedToMaster(next)
  const updated = await prisma.resume.update({
    where: { id: ctx.resume.id },
    data: {
      ...(master as unknown as Record<string, Prisma.InputJsonValue>),
      currentContent: next as unknown as Prisma.InputJsonValue,
      lastStructuredUpdate: new Date(),
    },
  })
  return NextResponse.json({ success: true, applied, master: toMasterDTO(updated) })
}
