// POST { keywords, answers, additions } -> writes the accepted additions into the MASTER
// and returns it with the new fit. Each addition is re-guarded against its answer here,
// so the client can only add what the guard would have passed. Editing, not AI: this
// works while AI is paused.
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { masterToParsed, parsedToMaster } from '@/lib/master-resume'
import { toMasterDTO } from '@/lib/master-dto'
import { applySkillAdditions, cleanAnswers, cleanKeywords, fitCoverage, guardAddition, type SkillAddition } from '@/lib/skill-check'
import { evidenceContext } from '../../evidence/shared'
import { track } from '@/lib/track'

export const runtime = 'nodejs'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.keywords) || !Array.isArray(body.answers) || !Array.isArray(body.additions)) {
    return NextResponse.json({ error: 'keywords, answers and additions are required' }, { status: 400 })
  }

  const ctx = await evidenceContext(id, { feature: 'skillCheck' })
  if ('error' in ctx) return ctx.error

  const resume = masterToParsed(ctx.resume)
  const keywords = cleanKeywords((body.keywords as unknown[]).filter((k): k is string => typeof k === 'string'))
  const answers = cleanAnswers(body.answers, keywords)
  const checked: SkillAddition[] = []
  for (const raw of body.additions as SkillAddition[]) {
    if (!raw || typeof raw.keyword !== 'string' || typeof raw.text !== 'string' || typeof raw.target !== 'string') continue
    const answer = answers.find((a) => a.keyword.toLowerCase() === raw.keyword.toLowerCase())
    if (answer) checked.push(guardAddition(resume, answer, raw))
  }

  const { resume: next, applied } = applySkillAdditions(resume, checked)
  await track('skill_check_applied', { applied, kinds: checked.map((c) => c.kind).join(',') }, ctx.userId)
  if (applied === 0) {
    return NextResponse.json({ success: true, applied: 0, master: toMasterDTO(ctx.resume), coverage: fitCoverage(keywords, resume) })
  }
  const updated = await prisma.resume.update({
    where: { id: ctx.resume.id },
    data: {
      ...(parsedToMaster(next) as unknown as Record<string, Prisma.InputJsonValue>),
      currentContent: next as unknown as Prisma.InputJsonValue,
      lastStructuredUpdate: new Date(),
    },
  })
  return NextResponse.json({ success: true, applied, master: toMasterDTO(updated), coverage: fitCoverage(keywords, next) })
}
