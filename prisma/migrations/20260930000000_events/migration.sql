-- Product analytics events (src/lib/track.ts): funnel, errors, OpenAI token usage, and
-- the per-user daily ceilings in src/lib/daily-ceiling.ts.
-- Additive only. userId goes NULL when a user deletes their account.

CREATE TABLE IF NOT EXISTS "events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "props" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "events_name_createdAt_idx" ON "events"("name", "createdAt");
CREATE INDEX IF NOT EXISTS "events_userId_name_createdAt_idx" ON "events"("userId", "name", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_userId_fkey') THEN
    ALTER TABLE "events" ADD CONSTRAINT "events_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- Same as every other table (20260927000000_enable_rls): RLS on, no policies, so
-- Supabase's REST/GraphQL API can't read it. Prisma connects as the owner and bypasses RLS.
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
