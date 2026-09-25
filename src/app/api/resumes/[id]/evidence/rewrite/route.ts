// POST { items: EvidenceItem[], answers: EvidenceAnswer[] } -> saves the answers on the
// resume (even if the rewrite fails: they're the user's facts), then rewrites the answered
// bullets from the original text + answers only. Nothing is applied to the master here.
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { masterToParsed } from '@/lib/master-resume'
import { candidateForBullet, EvidenceError, mergeEvidence, rewriteWithEvidence, type EvidenceAnswer, type EvidenceItem } from '@/lib/evidence'
import { evidenceContext } from '../shared'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_ANSWER = 300

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await evidenceContext(id, { rateLimit: true })
  if ('error' in ctx) return ctx.error

  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.items) || !Array.isArray(body.answers)) {
    return NextResponse.json({ error: 'items and answers are required' }, { status: 400 })
  }

  // Trust nothing about the bullets from the client: each item must still be in the master.
  const resume = masterToParsed(ctx.resume)
  const items: EvidenceItem[] = []
  for (const raw of body.items as EvidenceItem[]) {
    const found = raw && typeof raw.entryId === 'string' && typeof raw.bullet === 'string' ? candidateForBullet(resume, raw.entryId, raw.bullet) : null
    if (!found || !Array.isArray(raw.questions)) continue
    items.push({
      ...found,
      id: raw.id,
      weakness: String(raw.weakness ?? ''),
      questions: raw.questions.filter((q) => q && typeof q.text === 'string').slice(0, 3),
    })
  }
  const itemById = new Map(items.map((i) => [i.id, i]))
  const now = new Date().toISOString()
  const answers: EvidenceAnswer[] = (body.answers as EvidenceAnswer[])
    .filter((a) => a && typeof a.answer === 'string' && itemById.has(a.itemId))
    .map((a) => {
      const item = itemById.get(a.itemId)!
      const question = item.questions.find((q) => q.id === a.questionId)
      return {
        itemId: item.id,
        entryLabel: item.entryLabel,
        bullet: item.bullet,
        questionId: String(a.questionId),
        question: question?.text ?? '',
        answer: a.answer.trim().slice(0, MAX_ANSWER),
        answeredAt: now,
      }
    })
    .filter((a) => a.question)

  await prisma.resume.update({
    where: { id: ctx.resume.id },
    data: { evidence: mergeEvidence(ctx.resume.evidence, answers) as unknown as Prisma.InputJsonValue },
  })

  try {
    const rewrites = await rewriteWithEvidence(items, answers)
    return NextResponse.json({ success: true, rewrites })
  } catch (error) {
    if (error instanceof EvidenceError) {
      console.error('❌ Evidence rewrite error:', error.message)
      return NextResponse.json({ success: false, error: `${error.userMessage} Your answers are saved.` }, { status: error.status })
    }
    throw error
  }
}
