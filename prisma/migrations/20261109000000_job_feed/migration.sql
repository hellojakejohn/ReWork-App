-- Matches on upload (docs/job-feed-plan.md): shared jobs from public company boards, each
-- resume's matches, and its "what job do you want next" answer.
-- Additive only (three new tables, nothing changes on existing ones). Idempotent: safe to
-- paste twice. Until it's applied the feed shows nothing and the rest of the app is unchanged.

CREATE TABLE IF NOT EXISTS "jobs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "board" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "usState" TEXT,
    "country" TEXT NOT NULL,
    "payLabel" TEXT,
    "postedAt" TIMESTAMP(3),
    "description" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL,
    "keywords" TEXT[],
    "keywordsAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "job_matches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "prescore" INTEGER NOT NULL,
    "present" TEXT[],
    "related" TEXT[],
    "missing" TEXT[],
    "seenAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "savedAt" TIMESTAMP(3),
    "applicationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_matches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "feed_prefs" (
    "resumeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetTitles" TEXT[],
    "workplace" TEXT NOT NULL DEFAULT 'both',
    "matchedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feed_prefs_pkey" PRIMARY KEY ("resumeId")
);

CREATE INDEX IF NOT EXISTS "jobs_closedAt_country_idx" ON "jobs"("closedAt", "country");
CREATE INDEX IF NOT EXISTS "jobs_board_idx" ON "jobs"("board");
CREATE INDEX IF NOT EXISTS "job_matches_userId_resumeId_score_idx" ON "job_matches"("userId", "resumeId", "score");
CREATE INDEX IF NOT EXISTS "job_matches_jobId_idx" ON "job_matches"("jobId");
CREATE UNIQUE INDEX IF NOT EXISTS "job_matches_resumeId_jobId_key" ON "job_matches"("resumeId", "jobId");
CREATE INDEX IF NOT EXISTS "feed_prefs_userId_idx" ON "feed_prefs"("userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_matches_userId_fkey') THEN
    ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_matches_resumeId_fkey') THEN
    ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_resumeId_fkey"
      FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_matches_jobId_fkey') THEN
    ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_jobId_fkey"
      FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feed_prefs_resumeId_fkey') THEN
    ALTER TABLE "feed_prefs" ADD CONSTRAINT "feed_prefs_resumeId_fkey"
      FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feed_prefs_userId_fkey') THEN
    ALTER TABLE "feed_prefs" ADD CONSTRAINT "feed_prefs_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- Same lock-down as every other table (20260927000000_enable_rls, 20261024000000_db_hardening):
-- RLS on with no policies, and Supabase's REST/GraphQL roles get no access to new tables.
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_prefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jobs, public.job_matches, public.feed_prefs FROM anon, authenticated;
