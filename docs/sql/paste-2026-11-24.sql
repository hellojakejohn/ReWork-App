-- Paste once in Supabase > SQL Editor > New query > Run (Nov 24), BEFORE merging the
-- daily brief PR. Additive and safe to run twice. Until it's applied everyone stays on the
-- weekly email and choosing Daily in settings says "couldn't save".

-- The daily brief instead of the weekly email (src/lib/email/prefs.ts).
ALTER TABLE "email_prefs" ADD COLUMN IF NOT EXISTS "daily" BOOLEAN NOT NULL DEFAULT false;
