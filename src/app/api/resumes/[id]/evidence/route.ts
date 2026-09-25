// POST { focus?: { entryId, bullet } } -> questions for the master's weakest bullets (or
// just the focused one, from the Changes tab). Also returns answers given before, so the
// form can prefill them. Pro only.
import { NextRequest, NextResponse } from 'next/server'
import { masterToParsed } from '@/lib/master-resume'
import { candidateForBullet, EvidenceError, generateQuestions, readStoredEvidence, weakBulletCandidates } from '@/lib/evidence'
import { evidenceContext } from './shared'
import { collectUsage, usageProps } from '@/lib/ai-usage'
import { track } from '@/lib/track'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await evidenceContext(id, { rateLimit: true })
  if ('error' in ctx) return ctx.error

  const body = await request.json().catch(() => ({}))
  const resume = masterToParsed(ctx.resume)
  const focus = body?.focus
  const candidates =
    focus && typeof focus.entryId === 'string' && typeof focus.bullet === 'string'
      ? [candidateForBullet(resume, focus.entryId, focus.bullet)].filter((c) => c !== null)
      : weakBulletCandidates(resume)

  if (candidates.length === 0) {
    return NextResponse.json({
      success: true,
      items: [],
      answers: [],
      message: focus
        ? "That bullet isn't in your resume anymore. Tailor again, then try it from the Changes tab."
        : 'Your bullets already have numbers and outcomes. Nothing to ask.',
    })
  }

  const { run, usage } = collectUsage(() => generateQuestions(candidates, { focused: !!focus }))
  try {
    const items = await run
    await track('ai_usage', { feature: 'evidence_questions', ...usageProps(usage()) }, ctx.userId)
    return NextResponse.json({ success: true, items, answers: readStoredEvidence(ctx.resume.evidence).answers })
  } catch (error) {
    await track('ai_error', { feature: 'evidence', kind: error instanceof EvidenceError ? error.kind : 'unexpected', ...usageProps(usage()) }, ctx.userId)
    if (error instanceof EvidenceError) {
      console.error('❌ Evidence questions error:', error.message)
      return NextResponse.json({ success: false, error: error.userMessage }, { status: error.status })
    }
    throw error
  }
}
