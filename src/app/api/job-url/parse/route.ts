// POST { url } -> { success: true, job } | { success: false, needsPaste: true, message }
// Resolver chain lives in src/lib/job-resolve. Every fetch (ATS APIs included) goes
// through safeFetch, which blocks private/loopback/metadata addresses on every hop.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkRateLimit, rateLimitResponseBody } from '@/lib/rate-limit';
import { UnsafeUrlError, assertSafeUrl, safeFetch } from '@/lib/safe-fetch';
import { refuseLinkedIn, resolveJob, type FetchedPage } from '@/lib/job-resolve';
import { extractJobWithModel } from '@/lib/job-resolve/model-extract';
import { collectUsage, usageProps } from '@/lib/ai-usage';
import { getAIBudget, type AIBudget } from '@/lib/ai-cap';
import { providerConfigured, taskRoute } from '@/lib/ai/routing';
import { msSince, track } from '@/lib/track';

export const runtime = 'nodejs';
export const maxDuration = 300; // Vercel Pro; the model reader can be slow on long pages

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function fetchPage(url: string, accept: 'json' | 'html'): Promise<FetchedPage> {
  const res = await safeFetch(url, {
    checkUrl: refuseLinkedIn, // never fetch LinkedIn, not even through a redirect
    maxRedirects: 3,
    timeoutMs: 8000,
    maxBytes: 3 * 1024 * 1024,
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: accept === 'json' ? 'application/json' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.8',
    },
  });
  return { status: res.status, url: res.url, text: res.text };
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rate = checkRateLimit(`job-url:${session.user.id || session.user.email}`);
  if (!rate.allowed) {
    return NextResponse.json(rateLimitResponseBody(rate.retryAfterSeconds), {
      status: 429,
      headers: { 'Retry-After': String(rate.retryAfterSeconds) }
    });
  }

  let url: unknown;
  try {
    ({ url } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body', success: false }, { status: 400 });
  }
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Paste a job posting URL', success: false }, { status: 400 });
  }

  let validated: URL;
  try {
    validated = assertSafeUrl(url.trim());
  } catch (error) {
    const message = error instanceof UnsafeUrlError ? error.message : 'Invalid URL';
    return NextResponse.json({ error: message === 'Invalid URL' ? "That doesn't look like a link." : message, success: false }, { status: 400 });
  }

  const userId = session.user.id ?? null;
  const start = Date.now();
  // The model reader is the last resolver. It's skipped (straight to paste) when its
  // provider has no key or the user's AI is paused by the AI cap.
  const ai: AIBudget | null = userId ? await getAIBudget(userId) : null;
  const modelAllowed = providerConfigured(taskRoute('jobExtract').provider) && ai?.state.band !== 'paused';
  const { run, usage } = collectUsage(
    () =>
      resolveJob(validated.href, {
        fetchPage,
        extractWithModel: modelAllowed ? extractJobWithModel : undefined
      }),
    ai?.scope
  );
  try {
    const result = await run;
    await ai?.settle(usage().costUsd);
    if (!result.ok) {
      await track('job_fetched', { ok: false, resolver: 'needsPaste', reason: result.reason, ms: msSince(start), ...usageProps(usage()) }, userId);
      return NextResponse.json({ success: false, needsPaste: true, reason: result.reason, message: result.message });
    }
    await track('job_fetched', { ok: true, resolver: result.job.source, ms: msSince(start), ...usageProps(usage()) }, userId);
    return NextResponse.json({ success: true, job: result.job });
  } catch (error) {
    console.error('❌ Job URL resolve error:', error);
    await ai?.settle(usage().costUsd);
    await track('job_fetched', { ok: false, resolver: 'needsPaste', reason: 'error', ms: msSince(start), ...usageProps(usage()) }, userId);
    return NextResponse.json({
      success: false,
      needsPaste: true,
      reason: 'unreachable',
      message: "We couldn't read that page. Paste the description instead."
    });
  }
}
