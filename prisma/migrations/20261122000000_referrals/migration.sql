-- Referrals (src/lib/referrals.ts): invite codes and who joined through whose link.
-- Additive only (two new tables). Idempotent: safe to paste twice. Until it's applied the
-- invite section says "coming soon" and nothing else changes.

CREATE TABLE IF NOT EXISTS "referral_codes" (
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("userId")
);
CREATE UNIQUE INDEX IF NOT EXISTS "referral_codes_code_key" ON "referral_codes"("code");

CREATE TABLE IF NOT EXISTS "referrals" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rewardedAt" TIMESTAMP(3),
    "referrerRewarded" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "referrals_referredId_key" ON "referrals"("referredId");
CREATE INDEX IF NOT EXISTS "referrals_referrerId_rewardedAt_idx" ON "referrals"("referrerId", "rewardedAt");

DO $$ BEGIN
  ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey"
    FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredId_fkey"
    FOREIGN KEY ("referredId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Same lockdown as every table (STATE.md "Migrations"): RLS on, no grants for Supabase's
-- public roles. Prisma connects as the owner and isn't affected.
ALTER TABLE "referral_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "referrals" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "referral_codes" FROM anon, authenticated;
REVOKE ALL ON TABLE "referrals" FROM anon, authenticated;
