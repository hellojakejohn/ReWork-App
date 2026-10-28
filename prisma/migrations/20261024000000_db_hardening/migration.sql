-- Applied 2026-10-24 on oxedndnmssyuffkfkcug via the Supabase MCP (with 20261002000000_ai_cap_overrides).
-- Additive only. Idempotent.

-- Foreign-key indexes the Supabase performance advisor flagged.
CREATE INDEX IF NOT EXISTS "accounts_userId_idx" ON "accounts"("userId");
CREATE INDEX IF NOT EXISTS "sessions_userId_idx" ON "sessions"("userId");
CREATE INDEX IF NOT EXISTS "resumes_userId_idx" ON "resumes"("userId");
CREATE INDEX IF NOT EXISTS "job_applications_userId_createdAt_idx" ON "job_applications"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "job_applications_resumeId_idx" ON "job_applications"("resumeId");
CREATE INDEX IF NOT EXISTS "feedback_userId_idx" ON "feedback"("userId");

-- The app reaches Postgres only through Prisma as the table owner. Supabase's REST/GraphQL
-- roles get no table access (RLS already returned no rows; this also hides the schema).
-- Supabase grants these roles on NEW tables by default: repeat this after creating one.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
