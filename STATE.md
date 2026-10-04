# ReWork Project State

Current truth as of the `ai-providers` branch (October 2026). History lives in git.

## Product
ReWork (rework.hellojakejohn.com): upload a resume once, paste a job link, get a tailored
resume and cover letter. Every rewrite is fact-checked against the original. Operated by
Jakob Johnson (individual, Saint Paul, MN). Contact hellojakejohn@gmail.com.

- Free: 3 tailors/month, 1 cover letter/month, tracker up to 10 jobs, PDF downloads.
- Job Hunt Pass $29 one-time for 90 days of Pro, never renews, stacks (the headline offer:
  cheaper than 2 months of Pro). Pro Monthly $15/month.
- Pro: tailoring and cover letters for a whole search, evidence interview, tracker for every
  job, Word export. Never "unlimited": copy says "Fair use: plenty for an active job search".
- Daily ceilings for everyone, Pro included (abuse guard): 20 tailors, 20 cover letters,
  10 parses, 10 evidence interviews per UTC day.
- AI cap per user (the money guard): AI_CAP_RATIO (0.70) x net revenue for the period
  (Pro ~$9.99/month, pass ~$19.50 for its whole 90 days, FREE $0.50/month, revisit after the real eval). 75%: paid calls
  run on AI_FREE_TIER with a header banner. 100%: AI pauses until the reset date; downloads,
  tracker and editing keep working. Users see a percent, never dollars. Admin can override
  per user. `src/lib/ai-cap-rules.ts`.
- Input caps: resume file 4 MB (Vercel rejects bodies over 4.5 MB), pasted resume 30k chars,
  job description 20k chars.
- All numbers live in `src/lib/plans.ts`.

## Tech stack
Next.js 15.3 (App Router), TypeScript, Tailwind, Radix UI, Prisma 6.8.2 on Supabase Postgres
(us-west-2, project ref oxedndnmssyuffkfkcug), Supabase Storage, NextAuth v4 (Google,
database sessions), Stripe, @react-pdf/renderer, docx, Vercel (+ Analytics, Cron).
AI: one provider layer in `src/lib/ai/` (`generateStructured`). Anthropic (default when
ANTHROPIC_API_KEY is set: claude-opus-5-5 for every task), OpenAI, or OpenRouter, routed per
task by `AI_*` env (`provider:model`). Prices in `src/lib/ai/models.ts`.
`npm run eval:models` compares models on the fixtures (cost, latency, quality).

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
  tailored, cover_letter_generated, evidence_started, evidence_completed, checkout_started,
  checkout_completed, limit_hit, download, ai_error, ai_usage, ai_call, ai_cap_band,
  account_deleted. Every provider call writes an `ai_call` event (provider, model, task,
  tokens, cached tokens, estimated cost): the source of truth for spend and the AI cap.
- `/admin`: 7/30-day event counts, signup cohort funnel with conversion, errors by kind,
  recent errors, AI spend by day and by model, active Pro, MRR and pass revenue estimates.
  Users table: month-to-date AI spend, period cap, and a per-user cap override.

## Migrations
Applied by hand in the Supabase SQL editor. Written but NOT applied yet:
- `20260928000000_resume_replace`
- `20260929000000_pro_features`
- `20260930000000_events` (events table, RLS on)
- `20261002000000_ai_cap_overrides` (per-user AI cap override, RLS on)

Until `events` is applied, tracking logs and drops events, and daily ceilings AND the AI cap
fail open (spend reads as 0, so nobody is ever downgraded or paused). Apply it before relying
on the cap. Until `ai_cap_overrides` is applied, overrides can't be saved.

## Environment
See README.md for the full table. Required in production: DATABASE_URL, NEXTAUTH_URL,
NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ANTHROPIC_API_KEY (and
OPENAI_API_KEY / OPENROUTER_API_KEY only if a task routes there), NEXT_PUBLIC_SUPABASE_URL,
SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
STRIPE_PRICE_PRO_MONTHLY ($15 price), STRIPE_PRICE_PASS ($29 price; the old
STRIPE_PRICE_PASS_30D name is still read), CRON_SECRET. Recommended: AI_FREE_TIER=
anthropic:claude-sonnet-5-5.

## Checks
- `npx tsc --noEmit` clean, `npm test` (Vitest, offline), `npm run build` with no app env.
- Lighthouse mobile on `/` (local prod build): performance 99-100, accessibility 100,
  SEO 100, best practices 96 (only the local 404 of the Vercel Analytics script).
  Simulated LCP 1.8-2.1 s, observed about 0.2 s.

## Known gaps / next
- Rate limiting is an in-memory speed bump per lambda; daily ceilings and the AI cap are the real caps.
- AI routes (parse, job URL, tailor, cover letter, evidence) run with maxDuration 300 (Vercel
  Pro), since Opus 5.5 thinks on every call.
- Refusal fallback is same-provider only: Opus 5.5 -> Sonnet 5.5 server-side. Sonnet 5.5 has
  none. Nothing ever falls back to OpenAI or OpenRouter (resume PII).
- OpenRouter is wired but not in the privacy policy; update /privacy before routing
  production traffic there.
- LinkedIn job URLs are never fetched (also not through redirects): straight to paste.
- Landing example is hand-built from `scripts/fixtures/restaurant-manager-to-ops-coordinator.json`
  in the result's shape; swap in real `npm run eval:tailor` output when convenient.
- npm audit findings and the Prisma 7 upgrade are parked (needs explicit OK).
- Out of scope for launch: job feed, post-a-job, crypto payments, interview prep.
