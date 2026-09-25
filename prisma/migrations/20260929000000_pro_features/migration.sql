-- Pro features: cover letters, evidence interview, application tracker.
-- Additive only, safe on live tables. RLS is already enabled on users, resumes and
-- job_applications (20260927000000_enable_rls); no policy changes needed.

-- Cover letter metering (FREE: 1/month, see src/lib/plans.ts)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "monthlyCoverLetters" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "coverLettersResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Evidence interview answers
ALTER TABLE "resumes" ADD COLUMN IF NOT EXISTS "evidence" JSONB;

-- Cover letter per job + tracker fields
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "coverLetter" JSONB;
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "coverLetterUpdatedAt" TIMESTAMP(3);
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "followUpAt" TIMESTAMP(3);
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "statusUpdatedAt" TIMESTAMP(3);
