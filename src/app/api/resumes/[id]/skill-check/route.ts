// POST { title, company, description } -> the job's keywords and how many the master
// shows: { keywords, coverage }. Free for everyone; one small model call.
import { NextRequest, NextResponse } from 'next/server'
import { masterToParsed } from '@/lib/master-resume'
import { extractJobKeywords, fitCoverage, SkillCheckError } from '@/lib/skill-check'
import { INPUT_LIMITS } from '@/lib/plans'
import { evidenceContext } from '../evidence/shared'
import { collectUsage, usageProps } from '@/lib/ai-usage'
import { track } from '@/lib/track'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const job = {
    title: typeof body?.title === 'string' ? body.title.slice(0, 200) : '',
    company: typeof body?.company === 'string' ? body.company.slice(0, 200) : '',
    description: typeof body?.description === 'string' ? body.description : '',
  }
  if (job.description.trim().length < 50 || job.description.length > INPUT_LIMITS.jobDescriptionChars) {
    return NextResponse.json({ error: 'A job description is required' }, { status: 400 })
  }

  const ctx = await evidenceContext(id, { rateLimit: true, dailyCeiling: true, ai: true, feature: 'skillCheck' })
  if ('error' in ctx) return ctx.error
  const ai = ctx.ai!

  const { run, usage } = collectUsage(() => extractJobKeywords(job), ai.scope)
  try {
    const keywords = await run
    const coverage = fitCoverage(keywords, masterToParsed(ctx.resume))
    await track('skill_check', { step: 'keywords', ok: true, keywords: keywords.length, score: coverage.score, ...usageProps(usage()) }, ctx.userId)
    return NextResponse.json({ success: true, keywords, coverage })
  } catch (error) {
    await track('skill_check', { step: 'keywords', ok: false, ...usageProps(usage()) }, ctx.userId)
    await track('ai_error', { feature: 'skill_check', kind: error instanceof SkillCheckError ? error.kind : 'unexpected', ...usageProps(usage()) }, ctx.userId)
    if (error instanceof SkillCheckError) {
      console.error('❌ Skill check error:', error.message)
      return NextResponse.json({ success: false, error: error.userMessage }, { status: error.status })
    }
    throw error
  } finally {
    await ai.settle(usage().costUsd)
  }
}
