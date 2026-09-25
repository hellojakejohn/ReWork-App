-- Replace resume + stale-parse banner. Additive only, safe on a live table.
-- RLS is already enabled on resumes (20260927000000_enable_rls); no policy changes.
ALTER TABLE "resumes" ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP(3);
ALTER TABLE "resumes" ADD COLUMN IF NOT EXISTS "parserVersion" TEXT;

-- Rows saved by the structured parser before this column existed are not stale.
UPDATE "resumes" SET "parserVersion" = '2'
WHERE "parserVersion" IS NULL AND "structuredDataVersion" = 'parse-v1';
