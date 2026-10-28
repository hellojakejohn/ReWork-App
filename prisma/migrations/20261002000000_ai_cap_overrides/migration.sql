-- Per-user AI cap override set from /admin (src/lib/ai-cap.ts). Additive only.
-- Until this is applied, overrides can't be saved and every user gets the default cap.

CREATE TABLE IF NOT EXISTS "ai_cap_overrides" (
    "userId" TEXT NOT NULL,
    "capUsd" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_cap_overrides_pkey" PRIMARY KEY ("userId")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cap_overrides_userId_fkey') THEN
    ALTER TABLE "ai_cap_overrides" ADD CONSTRAINT "ai_cap_overrides_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- Month-to-date AI spend sums ai_call events per user; this index keeps it cheap.
-- (events_userId_name_createdAt_idx from 20260930000000_events already covers it.)

ALTER TABLE public.ai_cap_overrides ENABLE ROW LEVEL SECURITY;
