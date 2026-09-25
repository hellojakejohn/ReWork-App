-- Enable row level security on every table in the public schema that doesn't have it.
--
-- No policies on purpose. The app only reaches Postgres through Prisma as the table
-- owner (the postgres role), which bypasses RLS, so nothing in the app changes. What this
-- closes is Supabase's auto-generated REST/GraphQL API: with RLS on and no policies, the
-- anon and authenticated roles can read or write nothing.
--
-- Expected to cover: users, accounts, sessions, verificationtokens, resumes,
-- resume_versions, job_applications, feedback, entitlements, stripe_events and
-- _prisma_migrations. The loop also catches any table created outside Prisma migrations.
-- Idempotent: tables that already have RLS are skipped.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.table_name);
    RAISE NOTICE 'RLS enabled on public.%', t.table_name;
  END LOOP;
END
$$;

-- Check afterwards (every row should say true):
-- SELECT relname, relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') ORDER BY relname;
