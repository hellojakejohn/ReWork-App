-- Entitlements (source of truth for Pro) + Stripe webhook idempotency.
-- Additive only. Safe to run on live tables.

-- CreateEnum
CREATE TYPE "EntitlementSource" AS ENUM ('STRIPE_SUBSCRIPTION', 'STRIPE_PASS', 'COMP', 'TOKEN_HOLD', 'TOKEN_PAYMENT');

-- CreateEnum
CREATE TYPE "EntitlementStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED', 'REFUNDED');

-- CreateTable
CREATE TABLE "entitlements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "EntitlementSource" NOT NULL,
    "status" "EntitlementStatus" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "pastDueAt" TIMESTAMP(3),
    "externalId" TEXT,
    "stripePriceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entitlements_userId_idx" ON "entitlements"("userId");

-- CreateIndex
CREATE INDEX "entitlements_status_endsAt_idx" ON "entitlements"("status", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "entitlements_source_externalId_key" ON "entitlements"("source", "externalId");

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: existing Stripe subscribers get an ACTIVE subscription entitlement.
-- endsAt is left NULL (open-ended) on purpose: the old webhook wrote a guessed
-- stripeCurrentPeriodEnd that may already be in the past, and the expiry cron would
-- then demote a paying user. The next customer.subscription.updated webhook (every
-- renewal) fills in the real period end.
INSERT INTO "entitlements" ("id", "userId", "source", "status", "startsAt", "endsAt", "externalId", "stripePriceId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id", 'STRIPE_SUBSCRIPTION', 'ACTIVE', CURRENT_TIMESTAMP, NULL, u."stripeSubscriptionId", u."stripePriceId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users" u
WHERE u."plan" = 'PREMIUM' AND u."stripeSubscriptionId" IS NOT NULL
ON CONFLICT ("source", "externalId") DO NOTHING;
