// POST { skills: string[] } -> { plans: (GapPlan & { links })[], partnerLinks }
// Close the gap for skills a job wants that the resume doesn't show. Free; counts toward the
// skill check's daily ceiling. Cached plans cost nothing; new ones are one small Sonnet call.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cleanSkills, gapLinks, gapPlans, generateGapPlans, GapPlanError } from '@/lib/gap-plan'
import { evidenceContext } from '../evidence/shared'
import { collectUsage, usageProps } from '@/lib/ai-usage'
import { track } from '@/lib/track'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const skills = cleanSkills(body?.skills)
  if (skills.length === 0) return NextResponse.json({ error: 'skills are required' }, { status: 400 })

  const ctx = await evidenceContext(id, { rateLimit: true, dailyCeiling: true, ai: true, feature: 'skillCheck' })
  if ('error' in ctx) return ctx.error
  const ai = ctx.ai!

  const { run, usage } = collectUsage(() => gapPlans(prisma, skills, (missing) => generateGapPlans(missing)), ai.scope)
  try {
    const { plans, generated } = await run
    const out = plans.map((p) => ({ ...p, links: gapLinks(p) }))
    await track('skill_check', { step: 'gap', ok: true, skills: skills.length, generated, ...usageProps(usage()) }, ctx.userId)
    return NextResponse.json({ success: true, plans: out, partnerLinks: out.some((p) => p.links.some((l) => l.partner)) })
  } catch (error) {
    await track('skill_check', { step: 'gap', ok: false, ...usageProps(usage()) }, ctx.userId)
    await track('ai_error', { feature: 'gap_plan', kind: error instanceof GapPlanError ? error.kind : 'unexpected', ...usageProps(usage()) }, ctx.userId)
    if (error instanceof GapPlanError) return NextResponse.json({ success: false, error: error.userMessage }, { status: error.status })
    throw error
  } finally {
    await ai.settle(usage().costUsd)
  }
}
