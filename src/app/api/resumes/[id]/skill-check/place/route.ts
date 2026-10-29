// POST { keywords, answers: SkillAnswer[] } -> proposed additions, one per Yes / A little
// answer. Nothing is written to the master here. If the model fails, every answer comes
// back as a plain skill: the user said they have it, so that much is always safe.
import { NextRequest, NextResponse } from 'next/server'
import { masterToParsed } from '@/lib/master-resume'
import { cleanAnswers, fallbackAdditions, fitCoverage, MAX_SKILL_QUESTIONS, placeSkills } from '@/lib/skill-check'
import { evidenceContext } from '../../evidence/shared'
import { collectUsage, usageProps } from '@/lib/ai-usage'
import { track } from '@/lib/track'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.keywords) || !Array.isArray(body.answers)) {
    return NextResponse.json({ error: 'keywords and answers are required' }, { status: 400 })
  }

  const ctx = await evidenceContext(id, { rateLimit: true, dailyCeiling: true, ai: true, feature: 'skillCheck' })
  if ('error' in ctx) return ctx.error
  const ai = ctx.ai!

  const resume = masterToParsed(ctx.resume)
  // Only keywords the resume is still missing can be answered.
  const keywords = (body.keywords as unknown[]).filter((k): k is string => typeof k === 'string').slice(0, 20)
  const answers = cleanAnswers(body.answers, fitCoverage(keywords, resume).missing).slice(0, MAX_SKILL_QUESTIONS)
  if (answers.length === 0) return NextResponse.json({ success: true, additions: [] })

  const { run, usage } = collectUsage(() => placeSkills(resume, answers), ai.scope)
  try {
    const additions = await run
    await track('skill_check', { step: 'place', ok: true, answers: answers.length, ...usageProps(usage()) }, ctx.userId)
    return NextResponse.json({ success: true, additions })
  } catch (error) {
    console.error('❌ Skill placement failed, offering plain skills:', (error as Error)?.message)
    await track('skill_check', { step: 'place', ok: false, ...usageProps(usage()) }, ctx.userId)
    return NextResponse.json({ success: true, additions: fallbackAdditions(resume, answers), fallback: true })
  } finally {
    await ai.settle(usage().costUsd)
  }
}
