-- Paste once in Supabase > SQL Editor > New query > Run.
-- Optional emails from the free tools (/check, /fit): src/lib/leads.ts, POST /api/leads.
-- Additive only, safe to run twice. Until it's applied the card still shows, but saving
-- an email answers "couldn't save that" and /admin shows leads as "table missing".

CREATE TABLE IF NOT EXISTS "leads" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT 'direct',
    "landing" TEXT,
    "consentVersion" TEXT NOT NULL,
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "leads_email_source_key" ON "leads"("email", "source");
CREATE INDEX IF NOT EXISTS "leads_createdAt_idx" ON "leads"("createdAt");
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "leads" FROM anon, authenticated;
