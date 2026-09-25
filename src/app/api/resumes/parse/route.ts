// POST /api/resumes/parse
//   multipart/form-data { file }   (PDF or DOCX, max 4 MB, see INPUT_LIMITS)
//   application/json { text }      (pasted resume)
// Either may carry `replaces: <resumeId>`: the new master becomes the active one and the
// old one is hidden (kept, listed in Manage resumes, deletable).
// Parses, validates, and saves a new master resume. Responds with an NDJSON stream of
// real stages (see src/lib/ndjson.ts) ending in { type: 'done', result: MasterResumeDTO }
// or { type: 'error' }. Nothing is saved if parsing fails.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAccess } from '@/lib/entitlements'
import { FREE_MAX_MASTER_RESUMES, INPUT_LIMITS, INPUT_LIMIT_MESSAGES, masterResumeLimitFor } from '@/lib/plans'
import { checkDailyCeiling } from '@/lib/daily-ceiling'
import { collectUsage, usageProps } from '@/lib/ai-usage'
import { msSince, track } from '@/lib/track'
import { checkRateLimit, rateLimitResponseBody } from '@/lib/rate-limit'
import { incrementResumeCount } from '@/lib/resume-count'
import { generateStorageKey, uploadToStorage } from '@/lib/storage'
import { parseResume, ResumeParseError, type ParseInput } from '@/lib/parse-resume'
import { parsedToMaster } from '@/lib/master-resume'
import { CURRENT_PARSER_VERSION, toMasterDTO } from '@/lib/master-dto'
import { ndjsonResponse } from '@/lib/ndjson'

export const runtime = 'nodejs'
export const maxDuration = 60

const PDF = 'application/pdf'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function kindOf(file: File): 'pdf' | 'docx' | null {
  const name = file.name.toLowerCase()
  if (file.type === PDF || name.endsWith('.pdf')) return 'pdf'
  if (file.type === DOCX || name.endsWith('.docx')) return 'docx'
  return null
}

const titleFrom = (name: string) => name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Resume'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  const rate = checkRateLimit(`parse:${userId}`)
  if (!rate.allowed) {
    return NextResponse.json(rateLimitResponseBody(rate.retryAfterSeconds), {
      status: 429,
      headers: { 'Retry-After': String(rate.retryAfterSeconds) },
    })
  }

  const ceiling = await checkDailyCeiling(userId, 'parse')
  if (!ceiling.allowed) {
    await track('limit_hit', { kind: 'daily_parse' }, userId)
    return NextResponse.json({ error: ceiling.message }, { status: 429 })
  }

  const masterLimit = masterResumeLimitFor((await getAccess(userId)).isPro)
  if (masterLimit !== Infinity) {
    const active = await prisma.resume.count({ where: { userId, isActive: true } })
    if (active >= masterLimit) {
      await track('limit_hit', { kind: 'master_resumes' }, userId)
      return NextResponse.json(
        {
          error: `Free accounts can keep up to ${FREE_MAX_MASTER_RESUMES} resumes. Delete one in Manage resumes (account menu) to add another, or go Pro for unlimited.`,
          upgradeRequired: true,
        },
        { status: 403 }
      )
    }
  }

  // ----- read input -----
  let input: ParseInput
  let file: File | null = null
  let replaces: string | null = null
  const contentType = request.headers.get('content-type') || ''
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const value = form.get('file')
      const replacesValue = form.get('replaces')
      if (typeof replacesValue === 'string' && replacesValue) replaces = replacesValue
      if (!(value instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      file = value
      if (file.size > INPUT_LIMITS.resumeFileBytes) return NextResponse.json({ error: INPUT_LIMIT_MESSAGES.resumeFile }, { status: 413 })
      const kind = kindOf(file)
      if (!kind) {
        return NextResponse.json({ error: 'Upload a PDF or DOCX (older .doc files: save as PDF first), or paste your resume text.' }, { status: 400 })
      }
      input = { kind, buffer: Buffer.from(await file.arrayBuffer()), filename: file.name }
    } else {
      const body = await request.json()
      const text = typeof body?.text === 'string' ? body.text : ''
      if (typeof body?.replaces === 'string' && body.replaces) replaces = body.replaces
      if (text.length > INPUT_LIMITS.resumeTextChars) return NextResponse.json({ error: INPUT_LIMIT_MESSAGES.resumeText }, { status: 413 })
      input = { kind: 'text', text }
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  return ndjsonResponse(async (send) => {
    const start = Date.now()
    const { run, usage } = collectUsage(() => parseResume(input, { onStage: (stage) => send({ type: 'stage', stage }) }))
    let result
    try {
      result = await run
    } catch (error) {
      const kind = error instanceof ResumeParseError ? error.kind : 'unexpected'
      await track('resume_parsed', { ok: false, ms: msSince(start), source: input.kind, kind, ...usageProps(usage()) }, userId)
      if (error instanceof ResumeParseError) {
        console.error('[parse] failed:', error.message)
        send({ type: 'error', status: error.status, error: error.userMessage })
        return
      }
      throw error
    }
    await track('resume_parsed', { ok: true, ms: msSince(start), source: input.kind, needsReview: result.needsReview.length, ...usageProps(usage()) }, userId)

    send({ type: 'stage', stage: 'saving' })

    // Keep the original file for the user's records. A storage hiccup shouldn't throw
    // away a good parse, so it's logged and skipped.
    let storageKey: string | null = null
    if (file && input.kind !== 'text') {
      const key = generateStorageKey(userId, file.name)
      const upload = await uploadToStorage(input.buffer, key, input.kind === 'pdf' ? PDF : DOCX, {
        'user-id': userId,
        'original-filename': file.name,
      }).catch((error) => ({ success: false, error: String(error) }))
      if (upload.success) storageKey = key
      else console.error('[parse] storage upload failed, saving without file:', upload.error)
    }

    const master = parsedToMaster(result.resume)
    const now = new Date()
    const title = file ? titleFrom(file.name) : result.resume.contact.fullName ? `${result.resume.contact.fullName} (pasted)` : 'Pasted resume'
    const row = await prisma.resume.create({
      data: {
        userId,
        title,
        ...(master as unknown as Record<string, Prisma.InputJsonValue>),
        currentContent: result.resume as unknown as Prisma.InputJsonValue,
        originalContent: {
          rawText: result.sourceText,
          parse: {
            version: 'parse-v1',
            model: result.model,
            needsReview: result.needsReview,
            parsedAt: now.toISOString(),
          },
          metadata: {
            source: input.kind,
            originalFileName: file?.name ?? null,
            fileSize: file?.size ?? null,
            uploadedAt: now.toISOString(),
          },
        } as unknown as Prisma.InputJsonValue,
        structuredDataVersion: 'parse-v1',
        parserVersion: CURRENT_PARSER_VERSION,
        lastStructuredUpdate: now,
        wordCount: result.sourceText.split(/\s+/).filter(Boolean).length,
        s3Key: storageKey,
        s3Bucket: storageKey ? 'resumes' : null,
        originalFileName: file?.name ?? null,
        fileSize: file?.size ?? null,
        contentType: file ? (input.kind === 'pdf' ? PDF : DOCX) : 'text/plain',
      },
    })
    await incrementResumeCount(userId)
    if (replaces && replaces !== row.id) {
      // updateMany scopes it to this user's own resume; a foreign id is a no-op.
      await prisma.resume.updateMany({ where: { id: replaces, userId, isActive: true }, data: { hiddenAt: now } })
    }

    send({ type: 'done', result: toMasterDTO(row) })
  })
}
