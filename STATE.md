# ReWork Project State

Current truth as of the `launch` branch (September 2026). History lives in git.

## Product
ReWork (rework.hellojakejohn.com): upload a resume once, paste a job link, get a tailored
resume and cover letter. Every rewrite is fact-checked against the original. Operated by
Jakob Johnson (individual, Saint Paul, MN). Contact hellojakejohn@gmail.com.

- Free: 3 tailors/month, 1 cover letter/month, tracker up to 10 jobs, PDF downloads.
- Pro Monthly $9/month, or Job Hunt Pass $15 for 30 days (one-time, stacks).
- Pro: unlimited tailoring and cover letters, evidence interview, unlimited tracker, Word export.
- Daily ceilings for everyone, Pro included: 40 tailors, 40 cover letters, 60 parses per UTC day.
- Input caps: resume file 4 MB (Vercel rejects bodies over 4.5 MB), pasted resume 30k chars,
  job description 20k chars.
- All numbers live in `src/lib/plans.ts`.

## Tech stack
Next.js 15.3 (App Router), TypeScript, Tailwind, Radix UI, Prisma 6.8.2 on Supabase Postgres
(us-west-2, project ref oxedndnmssyuffkfkcug), Supabase Storage, NextAuth v4 (Google,
database sessions), OpenAI API, Stripe, @react-pdf/renderer, docx, Vercel (+ Analytics, Cron).

## Pages
- `/` landing (server component), `/terms`, `/privacy`: public, no auth JS.
- `src/app/(app)/`: `/dashboard` (the one-page flow), `/dashboard/tracker`, `/pricing`,
  `/auth/signin`, `/admin`. The route group's layout holds the session/feedback providers
  and the toaster.
- `/sitemap.xml`, `/robots.txt`, `public/og-image.png` (1200x630).

## Account
- First run: new users land on the Resume card with a one-line welcome.
- Settings: Account (name/email from Google, plan, avatar color), Plan & billing, Your data
  (Download my data = JSON export; Delete my account = cancel live Stripe subscriptions,
  delete Storage files, delete the user row, which cascades). Deletion stops before
  deleting anything if Stripe can't cancel.

## Analytics
- Vercel Analytics for page views (needs Web Analytics enabled in the Vercel project).
- `events` table + `track()` (`src/lib/track.ts`): signed_up, resume_parsed, job_fetched,
  tailored, cover_letter_generated, evidence_completed, checkout_started, checkout_completed,
  limit_hit, download, ai_error, ai_usage, account_deleted. Model calls record token usage
  (`src/lib/ai-usage.ts`) and events carry tokens plus an estimated cost.
- `/admin`: 7/30-day event counts, signup cohort funnel with conversion, errors by kind,
  recent errors, OpenAI spend by day, active Pro, MRR and pass revenue estimates.

## Migrations
Applied by hand in the Supabase SQL editor. Written but NOT applied yet:
- `20260928000000_resume_replace`
- `20260929000000_pro_features`
- `20260930000000_events` (events table, RLS on)

Until `events` is applied, tracking logs and drops events and daily ceilings fail open.

## Environment
See README.md for the full table. Required in production: DATABASE_URL, NEXTAUTH_URL,
NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPENAI_API_KEY,
NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY,
STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PASS_30D, CRON_SECRET.

## Checks
- `npx tsc --noEmit` clean, `npm test` (Vitest, offline), `npm run build` with no app env.
- Lighthouse mobile on `/` (local prod build): performance 99-100, accessibility 100,
  SEO 100, best practices 96 (only the local 404 of the Vercel Analytics script).
  Simulated LCP 1.8-2.1 s, observed about 0.2 s.

## Known gaps / next
- Rate limiting is an in-memory speed bump per lambda; daily ceilings are the real cap.
- Landing example is hand-built from `scripts/fixtures/restaurant-manager-to-ops-coordinator.json`
  in the result's shape; swap in real `npm run eval:tailor` output when convenient.
- npm audit findings and the Prisma 7 upgrade are parked (needs explicit OK).
- Out of scope for launch: job feed, post-a-job, crypto payments, interview prep.
