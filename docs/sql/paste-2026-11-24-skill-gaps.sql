-- Paste once in Supabase > SQL Editor > New query > Run.
-- Close the gap (src/lib/gap-plan.ts): one cached plan per skill name, shared by everyone.
-- Additive only, safe to run twice. Until it's applied plans still work, just uncached.

CREATE TABLE IF NOT EXISTS "skill_gaps" (
    "key" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "plan" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "skill_gaps_pkey" PRIMARY KEY ("key")
);
ALTER TABLE "skill_gaps" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "skill_gaps" FROM anon, authenticated;
