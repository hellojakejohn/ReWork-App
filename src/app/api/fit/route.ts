// POST multipart { job, resumeText? , file? } -> how well the resume fits the job:
// { score, verdict, present, related, missing }. Public: no account, nothing stored.
// The resume is read with plain text extraction (no model); the job's keyword list is one
// free-tier model call (src/lib/public-fit.ts has the cost and abuse guards).
import { NextRequest, NextResponse } from 'next/server'
import { extractJobKeywords, SkillCheckError } from '@/lib/skill-check'
import { collectUsage, usageProps } from '@/lib/ai-usage'
import { getPublicAIScope } from '@/lib/ai-cap'
import { track } from '@/lib/track'
import { checkRateLimit } from '@/lib/rate-limit'
import { INPUT_LIMITS, INPUT_LIMIT_MESSAGES } from '@/lib/plans'
import { detectResumeKind } from '@/lib/upload-kind'
import { extractDocxText, extractPdfText, UnreadableFileError } from '@/lib/resume-source-text'
import {
  MIN_JOB_CHARS,
  MIN_RESUME_CHARS,
  PUBLIC_FIT_LIMIT_MESSAGE,
  cachedKeywords,
  jobKey,
  publicFit,
  publicFitOpen,
  rememberKeywords,
} from '@/lib/public-fit'

export const runtime = 'nodejs'
export const maxDuration = 60

const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status })

function visitorKey(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  return `fit:${ip}`
}

export async function POST(request: NextRequest) {
  const limit = checkRateLimit(visitorKey(request))
  if (!limit.allowed) return fail('Easy there. Try again in a few minutes, or sign up free to keep going.', 429)

  const form = await request.formData().catch(() => null)
  if (!form) return fail('Something went wrong sending that. Please try again.')

  const job = String(form.get('job') ?? '').slice(0, INPUT_LIMITS.jobDescriptionChars)
  if (job.trim().length < MIN_JOB_CHARS) return fail('Paste the whole job post: the duties and requirements, not just the title.')

  let resumeText = String(form.get('resumeText') ?? '').slice(0, INPUT_LIMITS.resumeTextChars)
  const file = form.get('file')
  if (file instanceof File && file.size > 0) {
    if (file.size > INPUT_LIMITS.resumeFileBytes) return fail(INPUT_LIMIT_MESSAGES.resumeFile, 413)
    const buffer = Buffer.from(await file.arrayBuffer())
    const kind = detectResumeKind(buffer)
    if (!kind) return fail('That file isn’t a PDF or Word document. Upload one of those, or paste your resume text.')
    try {
      resumeText = (kind === 'pdf' ? await extractPdfText(buffer) : await extractDocxText(buffer)).slice(0, INPUT_LIMITS.resumeTextChars)
    } catch (error) {
      if (error instanceof UnreadableFileError) return fail(error.message)
      console.error('[fit] could not read file:', (error as Error)?.message)
      return fail("We couldn't read that file. Paste your resume text instead.")
    }
  }
  if (resumeText.trim().length < MIN_RESUME_CHARS) return fail('Add your resume: upload a PDF or Word file, or paste the text.')

  const key = jobKey(job)
  let keywords = cachedKeywords(key)
  let usageExtra = {}
  if (!keywords) {
    if (!(await publicFitOpen())) return fail(PUBLIC_FIT_LIMIT_MESSAGE, 503)
    const ai = await getPublicAIScope()
    if (!ai) return fail(PUBLIC_FIT_LIMIT_MESSAGE, 503)
    const { run, usage } = collectUsage(() => extractJobKeywords({ title: '', company: '', description: job }), ai.scope)
    try {
      keywords = await run
      usageExtra = usageProps(usage())
    } catch (error) {
      await track('ai_error', { feature: 'fit_public', kind: error instanceof SkillCheckError ? error.kind : 'unexpected', ...usageProps(usage()) })
      return fail(error instanceof SkillCheckError ? error.userMessage : 'Something went wrong reading that job. Please try again.', 502)
    } finally {
      await ai.settle()
    }
    if (keywords.length === 0) return fail("We couldn't find any skills in that post. Paste the full job description.")
    rememberKeywords(key, keywords)
  }

  const fit = publicFit(keywords, resumeText)
  await track('fit_check_public', { score: fit.score, keywords: keywords.length, file: file instanceof File && file.size > 0, cached: !Object.keys(usageExtra).length, ...usageExtra })
  return NextResponse.json({ success: true, ...fit })
}
