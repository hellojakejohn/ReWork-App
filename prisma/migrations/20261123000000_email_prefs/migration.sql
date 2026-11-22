-- Email settings for the weekly "Your measurements" email (docs/weekly-email-plan.md).
-- Its own table, so the app keeps working before this is pasted (reads of a missing table
-- fail soft). Additive only, idempotent: safe to paste twice.

CREATE TABLE IF NOT EXISTS "email_prefs" (
    "userId" TEXT NOT NULL,
    "weekly" BOOLEAN NOT NULL DEFAULT true,
    "lastWeeklyAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_prefs_pkey" PRIMARY KEY ("userId")
);

DO $$ BEGIN
  ALTER TABLE "email_prefs" ADD CONSTRAINT "email_prefs_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "email_prefs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "email_prefs" FROM anon, authenticated;
