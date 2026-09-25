-- Additive: monthly tailor metering on users. Safe to run on a live table.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "monthlyTailors" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tailorsResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
