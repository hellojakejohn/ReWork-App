import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { applyTailorOutput, buildTailorInput, callTailorModel, TailorError } from '@/lib/tailor';
import { factGuard } from '@/lib/fact-guard';
import { coverageReport } from '@/lib/keyword-coverage';
import { getTailorQuota, incrementTailorCount } from '@/lib/tailor-quota';
import { checkRateLimit, rateLimitResponseBody } from '@/lib/rate-limit';
import { FREE_TAILORS_PER_MONTH, PRO_PRICE_DISPLAY } from '@/lib/plans';
import type { TailorCategoryScores, TailorReport } from '@/types/tailor';

// The Resume row is the MASTER. Tailoring reads from it and writes the result to a
// JobApplication; it never writes the master's structured fields.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    if (!resume) {
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
        error: `You've used all ${FREE_TAILORS_PER_MONTH} free tailored resumes this month. Upgrade to Pro (${PRO_PRICE_DISPLAY}) for unlimited tailoring.`,
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
    if (input.roles.length === 0 && input.education.length === 0) {
      return NextResponse.json({
        error: 'Resume content not found. Please fill out your resume first.'
      }, { status: 400 });
    }

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
        return NextResponse.json({ error: error.userMessage, success: false }, { status: error.status });
      }
      throw error;
    }

    const { cleaned, warnings } = factGuard(input, modelResult.output);
    const coverage = coverageReport(input, cleaned);
    const tailoredResume = applyTailorOutput(master, input, cleaned);

    const categoryScores: TailorCategoryScores = {
      keywordCoverageMaster: coverage.master.score,
      keywordCoverageTailored: coverage.tailored.score
    };
    const report: TailorReport = {
      version: 'tailor-v2',
      model: modelResult.model,
      warnings,
      missingKeywords: coverage.tailored.missing,
      bulletReasons: Object.fromEntries([
        ...cleaned.roles.map((r) => [r.id, r.bullets] as const),
        ...cleaned.projects.map((p) => [p.id, p.bullets] as const)
      ])
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
      analysisVersion: 'tailor-v2',
      status: 'OPTIMIZED' as const,
      lastAnalyzed: new Date()
    };

    // Re-tailor an explicit application, else reuse the one for the same job, else create
    const existingApplication = await prisma.jobApplication.findFirst({
      where: requestedApplicationId
        ? { id: String(requestedApplicationId), resumeId, userId }
        : { resumeId, userId, jobTitle, company: actualCompanyName }
    });

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
            jobUrl: requestData.jobUrl || null
          }
        });

    // Count only after the result is saved. Re-tailoring counts too.
    await incrementTailorCount(userId);
    await prisma.resume.update({
      where: { id: resumeId },
      data: { lastOptimized: new Date() }
    });

    return NextResponse.json({
      success: true,
      message: `Resume tailored for ${jobTitle} at ${actualCompanyName}`,
      applicationId: application.id,
      tailoredResume,
      warningsCount: warnings.length,
      keywordCoverage: {
        master: coverage.master.score,
        tailored: coverage.tailored.score,
        missing: coverage.tailored.missing
      },
      tailorsRemaining: quota.limit === Infinity ? null : Math.max(0, quota.remaining - 1)
    });

  } catch (error) {
    console.error('❌ Tailoring error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to tailor resume', details: errorMessage, success: false },
      { status: 500 }
    );
  }
}
