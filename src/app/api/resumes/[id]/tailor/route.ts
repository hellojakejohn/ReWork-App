import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { applyTailorOutput, buildTailorInput, callTailorModel, TailorError } from '@/lib/tailor';
import { factGuard } from '@/lib/fact-guard';
import { coverageReport } from '@/lib/keyword-coverage';
import { buildChanges } from '@/lib/tailor-changes';
import { getTailorQuota, incrementTailorCount } from '@/lib/tailor-quota';
import { checkRateLimit, rateLimitResponseBody } from '@/lib/rate-limit';
import { FREE_TAILORS_PER_MONTH, PRICING } from '@/lib/plans';
import { ndjsonResponse, type StreamEvent } from '@/lib/ndjson';
import { toApplicationDetail } from '@/lib/application-dto';
import type { TailorCategoryScores, TailorReport } from '@/types/tailor';

export const runtime = 'nodejs';
export const maxDuration = 60;

// The Resume row is the MASTER. Tailoring reads from it and writes the result to a
// JobApplication; it never writes the master's structured fields.
//
// Clients that send `Accept: application/x-ndjson` get a stream of real stages
// (reading -> rewriting -> checking -> saving) ending in { type: 'done' }; everyone
// else gets one JSON response. Auth, quota and validation errors are plain JSON either way.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: resumeId } = await params;

  let requestData;
  try {
    requestData = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request data', success: false }, { status: 400 });
  }

  const { jobTitle, company, companyName, location, description, jobDescription, extraContext, contextTags, applicationId: requestedApplicationId } = requestData;

  // Accept both company and companyName for backwards compatibility
  const actualCompanyName = company || companyName;
  const actualJobDescription = description || jobDescription;

  if (!jobTitle || !actualCompanyName || !actualJobDescription) {
    return NextResponse.json({ error: 'Missing required job information' }, { status: 400 });
  }

  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
    include: { user: true }
  });

  if (!resume || !resume.isActive) {
    return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
  }
  if (resume.user.email !== session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = resume.userId;

  const rate = checkRateLimit(`tailor:${userId}`);
  if (!rate.allowed) {
    return NextResponse.json(rateLimitResponseBody(rate.retryAfterSeconds), {
      status: 429,
      headers: { 'Retry-After': String(rate.retryAfterSeconds) }
    });
  }

  // Enforce the monthly limit BEFORE spending an OpenAI call
  const quota = await getTailorQuota(userId);
  if (!quota.allowed) {
    return NextResponse.json({
      success: false,
      error: `You've used all ${FREE_TAILORS_PER_MONTH} free tailored resumes this month. Go Pro for unlimited tailoring: ${PRICING.monthly.display} or ${PRICING.pass.display}.`,
      upgradeRequired: true,
      used: quota.used,
      limit: quota.limit
    }, { status: 402 });
  }

  const master = {
    contactInfo: resume.contactInfo,
    professionalSummary: resume.professionalSummary,
    workExperience: resume.workExperience,
    education: resume.education,
    skills: resume.skills,
    projects: resume.projects,
    additionalSections: resume.additionalSections
  };

  const input = buildTailorInput(master);
  if (input.roles.length === 0 && input.education.length === 0 && input.projects.length === 0) {
    return NextResponse.json({
      error: 'Your resume has no roles, projects or education yet. Add them first.'
    }, { status: 400 });
  }

  const run = async (send: (event: StreamEvent) => void) => {
    send({ type: 'stage', stage: 'reading' });
    send({ type: 'stage', stage: 'rewriting' });

    let modelResult;
    try {
      modelResult = await callTailorModel(
        input,
        { title: jobTitle, company: actualCompanyName, description: actualJobDescription, location },
        { extraContext, contextTags: Array.isArray(contextTags) ? contextTags : undefined }
      );
    } catch (error) {
      if (error instanceof TailorError) {
        console.error('❌ Tailor model error:', error.message);
        send({ type: 'error', status: error.status, error: error.userMessage });
        return;
      }
      throw error;
    }

    send({ type: 'stage', stage: 'checking' });
    const { cleaned, warnings } = factGuard(input, modelResult.output);
    const coverage = coverageReport(input, cleaned);
    const tailoredResume = applyTailorOutput(master, input, cleaned);
    const changes = buildChanges(input, cleaned);

    send({ type: 'stage', stage: 'saving' });
    const categoryScores: TailorCategoryScores = {
      keywordCoverageMaster: coverage.master.score,
      keywordCoverageTailored: coverage.tailored.score
    };
    const report: TailorReport = {
      version: 'tailor-v3',
      model: modelResult.model,
      warnings,
      missingKeywords: coverage.tailored.missing,
      bulletReasons: Object.fromEntries([
        ...cleaned.roles.map((r) => [r.id, r.bullets] as const),
        ...cleaned.projects.map((p) => [p.id, p.bullets] as const)
      ]),
      changes,
      targetKeywords: cleaned.targetKeywords,
      presentBefore: coverage.master.present,
      presentAfter: coverage.tailored.present,
      jobLocation: typeof location === 'string' ? location : ''
    };

    const applicationData = {
      jobDescription: actualJobDescription,
      originalContent: master as Prisma.InputJsonValue, // master snapshot at tailor time
      optimizedContent: cleaned as unknown as Prisma.InputJsonValue,
      optimizedStructured: tailoredResume as unknown as Prisma.InputJsonValue,
      matchScore: coverage.tailored.score,
      categoryScores: categoryScores as unknown as Prisma.InputJsonValue,
      keywords: cleaned.targetKeywords,
      suggestions: report as unknown as Prisma.InputJsonValue,
      analysisVersion: 'tailor-v3',
      status: 'OPTIMIZED' as const,
      lastAnalyzed: new Date()
    };

    // Re-tailor an explicit application; otherwise every tailor is its own application
    // (the Recent drawer lists them all).
    const existingApplication = requestedApplicationId
      ? await prisma.jobApplication.findFirst({ where: { id: String(requestedApplicationId), resumeId, userId } })
      : null;

    const application = existingApplication
      ? await prisma.jobApplication.update({
          where: { id: existingApplication.id },
          data: applicationData
        })
      : await prisma.jobApplication.create({
          data: {
            ...applicationData,
            userId,
            resumeId,
            jobTitle,
            company: actualCompanyName,
            jobUrl: typeof requestData.jobUrl === 'string' && requestData.jobUrl ? requestData.jobUrl : null
          }
        });

    // Count only after the result is saved. Re-tailoring counts too.
    await incrementTailorCount(userId);
    await prisma.resume.update({
      where: { id: resumeId },
      data: { lastOptimized: new Date() }
    });

    send({
      type: 'done',
      result: {
        application: toApplicationDetail(application),
        tailorsRemaining: quota.limit === Infinity ? null : Math.max(0, quota.remaining - 1)
      }
    });
  };

  if ((request.headers.get('accept') || '').includes('application/x-ndjson')) {
    return ndjsonResponse(run);
  }

  // Plain JSON: collect the stream's final event.
  let final: StreamEvent | null = null;
  try {
    await run((event) => {
      if (event.type !== 'stage') final = event;
    });
  } catch (error) {
    console.error('❌ Tailoring error:', error);
    return NextResponse.json({ error: 'Failed to tailor resume', success: false }, { status: 500 });
  }
  const result = final as StreamEvent | null;
  if (!result || result.type !== 'done') {
    return NextResponse.json(
      { error: result?.type === 'error' ? result.error : 'Failed to tailor resume', success: false },
      { status: result?.type === 'error' ? result.status : 500 }
    );
  }
  const done = result.result as { application: ReturnType<typeof toApplicationDetail>; tailorsRemaining: number | null };
  return NextResponse.json({
    success: true,
    applicationId: done.application.id,
    application: done.application,
    tailorsRemaining: done.tailorsRemaining
  });
}
