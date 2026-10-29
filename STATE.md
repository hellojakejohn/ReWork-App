# ReWork Project State

Current truth as of `main` on 2026-10-29 (PRs #7 to #22 merged and deployed). History lives in git. Launch audit and go/no-go: `docs/launch-audit.md`; token plan: `docs/token-plan.md`.

## Product
ReWork (rework.hellojakejohn.com): upload a resume once, paste a job link, get a tailored
resume and cover letter. Every rewrite is fact-checked against the original. Operated by
Jakob Johnson (individual, Saint Paul, MN). Contact hellojakejohn@gmail.com.

- Free: 3 tailors/month, 1 cover letter/month, tracker up to 10 jobs, PDF downloads, fit
  check + skill check (about $0.008 a call on Sonnet; counts toward the AI cap).
- Job Hunt Pass $29 one-time for 90 days of Pro, never renews, stacks (the headline offer:
  cheaper than 2 months of Pro). Pro Monthly $15/month.
- Pro: tailoring and cover letters for a whole search, evidence interview, tracker for every
  job, Word export. Never "unlimited": copy says "Fair use: plenty for an active job search".
- Daily ceilings for everyone, Pro included (abuse guard): 20 tailors, 20 cover letters,
  10 parses, 10 evidence interviews, 30 skill-check calls per UTC day.
- AI cap per user (the money guard): AI_CAP_RATIO (0.70) x net revenue for the period
  (Pro ~$9.99/month, pass ~$19.50 for its whole 90 days, FREE $0.50/month, revisit after the real eval). 75%: paid calls
  run on AI_FREE_TIER with a header banner. 100%: AI pauses until the reset date; downloads,
  tracker and editing keep working. Users see a percent, never dollars. Admin can override
  per user. `src/lib/ai-cap-rules.ts`. FREE fails closed if spend can't be read.
- Above every cap: `AI_DISABLED=1` pauses all AI (incident switch); `AI_FREE_DAILY_USD`
  (default 25, 0 = off) pauses FREE accounts once today's free-tier spend reaches it (paid
  users never: their cap keeps AI under what they paid). `ai_call` events carry `tier`. At most 2
  model calls per user in flight (`src/lib/ai-inflight.ts`, `ai_inflight` rows in events).
  Each provider call gets the time left before the route's 300s deadline as its timeout.
- Input caps: resume file 4 MB (Vercel rejects bodies over 4.5 MB), pasted resume 30k chars,
  job description 20k chars.
- All numbers live in `src/lib/plans.ts`.

## Tech stack
Next.js 15.5 (App Router), TypeScript, Tailwind, Radix UI, Prisma 6.8.2 on Supabase Postgres
(us-west-2, project ref oxedndnmssyuffkfkcug), Supabase Storage, NextAuth v4 (Google,
database sessions), Stripe, @react-pdf/renderer, docx, Vercel (+ Analytics, Cron).
AI: one provider layer in `src/lib/ai/` (`generateStructured`). Production is Anthropic only:
claude-opus-5-5 for every task, claude-sonnet-5-5 for the free tier and the decline retry.
Prepaid credits ($20, auto-reload off) are the hard spend limit. OpenAI and OpenRouter
adapters remain in code but nothing routes there and `OPENAI_API_KEY` is deleted in Vercel.
Routing is per task by `AI_*` env (`provider:model`). Prices in `src/lib/ai/models.ts`.
`npm run eval:models` runs the real pipeline on the fixtures (see "Quality eval" below).

## Brand
Lowercase "rework" in brand moments ("ReWork" stays in legal pages, Stripe and OAuth).
Spec: brand-kit/BRAND.md (gitignored; shipped assets in `public/brand/`). PDF exports embed
Tinos/Arimo (`src/lib/fonts/`, OFL), metric twins of Times/Helvetica with Latin Extended. Light first, dark
follows the system with a Light/Dark/System toggle in the account menu. Headings Newsreader,
UI Plus Jakarta Sans; PDF/DOCX exports keep their ATS-neutral fonts. OG image:
`node scripts/generate-og-image.js`.

## Pages
- `/` landing (server component), `/terms`, `/privacy`: public, no auth JS.
- `src/app/(app)/`: `/dashboard` (the one-page flow), `/dashboard/tracker`, `/pricing`,
  `/auth/signin`, `/admin`. The route group's layout holds the session/feedback providers
  and the toaster.
- `/sitemap.xml`, `/robots.txt`, `public/og-image.png` (1200x630).
- `/token` (public) and `/dashboard/token` (burn $REWORK for 30 days of Pro): both 404
  until `REWORK_MINT` is set. Not in the sitemap or footer; linked from X only.

## Account
- First run: new users land on the Resume card with a one-line welcome.
- Settings: Account (name/email from Google, plan, avatar color), Plan & billing, Your data
  (Download my data = JSON export; Delete my account = cancel live Stripe subscriptions,
  delete Storage files, delete the user row, which cascades). Deletion stops before
  deleting anything if Stripe can't cancel.

## Analytics
- Vercel Analytics for page views (needs Web Analytics enabled in the Vercel project).
- `events` table + `track()` (`src/lib/track.ts`): signed_up, resume_parsed, job_fetched,
  tailored, cover_letter_generated, evidence_started, evidence_completed, skill_check,
  skill_check_applied, checkout_started,
  checkout_completed, limit_hit, download, ai_error, ai_usage, ai_call, ai_cap_band,
  account_deleted. Every provider call writes an `ai_call` event (provider, model, task,
  tokens, cached tokens, estimated cost): the source of truth for spend and the AI cap.
- `/admin`: 7/30-day event counts, signup cohort funnel with conversion, errors by kind,
  recent errors, AI spend by day and by model, active Pro, MRR and pass revenue estimates.
  Users table: month-to-date AI spend, period cap, and a per-user cap override.

## Migrations
Applied by hand in the Supabase SQL editor (never `prisma migrate deploy`: the folder is out
of sync with Prisma's history table). Checked 2026-10-23 on project oxedndnmssyuffkfkcug
("ReWork Solutions"): RLS is on for all 12 tables (no policies; Prisma bypasses RLS as the
table owner).
2026-10-24: `20261002000000_ai_cap_overrides` and `20261024000000_db_hardening` (FK indexes,
and no table grants for Supabase's anon/authenticated roles) applied. Everything in the
folder is now applied. New tables: enable RLS and repeat the REVOKE (Supabase grants those
roles on new tables by default).

Daily ceilings still fail open if `events` can't be read (DB blip); the AI cap fails closed for FREE.

## Environment
See README.md for the full table. Required in production: DATABASE_URL, NEXTAUTH_URL,
NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ANTHROPIC_API_KEY (and
OPENAI_API_KEY / OPENROUTER_API_KEY only if a task routes there), NEXT_PUBLIC_SUPABASE_URL,
SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
STRIPE_PRICE_PRO_MONTHLY ($15 price), STRIPE_PRICE_PASS ($29 price; no fallback name),
CRON_SECRET (crons refuse every request without it). AI_FREE_TIER defaults to
anthropic:claude-sonnet-5-5 when ANTHROPIC_API_KEY is set. Token burn (optional, after
launch): REWORK_MINT, SOLANA_RPC_URL, AI_BURN_DAILY_USD (default 12).

## Billing guards
- The webhook grants a pass or a new subscription only for the configured price ids;
  subscriptions already tracked keep syncing after a price change (`src/lib/stripe-sync.ts`).
- `/api/health` (admins) fetches both Stripe prices and fails unless amount, currency and
  type match `plans.ts`. Check it after every price or env change.
- Monthly tailor/cover letter uses are reserved atomically before the model call and given
  back on failure (`reserveMonthly` in `src/lib/tailor-quota.ts`).

## Security
- Headers on every response (`next.config.ts`): frame-ancestors 'none' + X-Frame-Options,
  nosniff, strict-origin-when-cross-origin, and a full CSP in report-only. Watch the
  console for violations, then enforce it.
- Auth redirects are same-origin only and keep deep links (`src/lib/auth-redirect.ts`).
- Uploads are identified by magic bytes, not name/MIME (`src/lib/upload-kind.ts`).
- Middleware refuses cross-origin non-GET `/api/*` requests (webhook and crons exempt).
- CSP report-only reports to `/api/csp-report` (`[csp]` in runtime logs).
- Server errors (`src/instrumentation.ts`), webhook failures and orphaned files are
  `server_error` events, listed in `/admin`. `/api/health/live` is a public DB ping for uptime
  monitors; `/api/health` (admin) also checks the Stripe webhook endpoint, pings Opus with
  the production request shape, and reads a tiny PDF and DOCX with the real extractors
  (`checks.files`, `src/lib/health-files.ts`).

## Bundling (Vercel)
Libraries that load files at runtime by paths the bundler can't see must be listed in
`outputFileTracingIncludes` (`next.config.ts`). Today: pdfjs's worker and `@napi-rs/canvas`
(DOMMatrix polyfill) for `/api/resumes/parse` and `/api/health`; the PDF fonts for the
download routes. Missing ones pass every local test and fail only on Vercel (Oct 28: every PDF
upload failed). To check a route: `npm run build`, copy only the files in
`.next/server/app/<route>/route.js.nft.json` into an empty folder and run the library there.

## Checks
- `npx tsc --noEmit` clean, `npm test` (Vitest, offline), `npx next lint` 0 errors (lint now
  runs during `next build`), `npm run build` with no app env.
- Lighthouse mobile on `/` (local prod build): performance 99-100, accessibility 100,
  SEO 100, best practices 96 (only the local 404 of the Vercel Analytics script).
  Simulated LCP 1.8-2.1 s, observed about 0.2 s.

## Quality eval (2026-10-28)
`npm run -s eval:models -- --models anthropic:claude-opus-5-5,anthropic:claude-sonnet-5-5 --max-usd 3 --out eval-results/<name>`
runs parse -> tailor -> fact guard -> cover letter for real (billed, no DB). Needs
ANTHROPIC_API_KEY in the local env file. Private resumes go in `scripts/fixtures/private/`
(gitignored, run first, paired with the Greenhouse SWE and Web3 support jobs). Output in
`eval-results/` (gitignored): a report plus `cases/NN-*.json` with parsed, raw, cleaned,
coverage and the letter.

Upload round trip (`npx tsx --tsconfig tsconfig.json scripts/eval-parse-roundtrip.ts <case.json>`,
~$0.30): Classic PDF, Modern PDF, Word and pasted PDF text of the same resume all parse back
to the same shape (Oct 29, Jake's resume).

Last run (14 cases, after PR #13): no failures, no invented skills. Per full job (tailor +
letter) Opus ~$0.096 / 31s, Sonnet ~$0.034 / 14s. Letter rewrites 3 of 14 (all real
catches). Jake's resume vs the Web3 support job: 65% (Opus) / 75% (Sonnet) keyword coverage.

Tuning ideas not done yet:
- Tailoring itself adds only ~+3 coverage points (it never adds skills the resume lacks).
  The visible win could be surfacing keywords the resume proves in bullets but doesn't list
  as skills (e.g. "developer support", "RPC errors"), still fact-guarded.
- Bullets can't draw on extra sections (the guard scopes each bullet to its own role).
- Parse kept "live on Robinhood Chain mainnet" as its own project bullet; a project
  tagline/status line could be merged into the first bullet.
- Run more private resumes (non-tech, senior, long multi-page) before launch.

## Known gaps / next
- Rate limiting is an in-memory speed bump per lambda; daily ceilings and the AI cap are the real caps.
- AI routes (parse, job URL, tailor, cover letter, evidence, skill check) run with maxDuration 300 (Vercel
  Pro), since Opus 5.5 thinks on every call.
- Declines: Anthropic accepts no server-side fallback for Opus 5.5 or Sonnet 5.5
  (`allowed_fallback_models` null, prod 2026-10-28), so an Opus decline is retried once by the
  app on Sonnet 5.5 (`refusalRetry`). A Sonnet decline isn't retried. Never OpenAI or OpenRouter.
- Anthropic is the only AI provider in use and the only one in /privacy. The OpenAI and
  OpenRouter adapters are still in the code (tests use them); update /privacy before routing
  anything there. Full removal is a post-launch cleanup.
- Launch blocker: Stripe. Prod `STRIPE_SECRET_KEY` is an invalid `sk_test` key, so
  `/api/health` is `ok: false` on stripePrices and stripeWebhook (everything else passes).
  See "Next session" below.
- LinkedIn job URLs are never fetched (also not through redirects): straight to paste.
- Landing example is hand-built from `scripts/fixtures/restaurant-manager-to-ops-coordinator.json`
  in the result's shape; swap in real `npm run eval:tailor` output when convenient.
- npm audit: 0 critical. Remaining moderate/high (postcss and sharp via next, zod via
  openai 4) need majors (Next 16, openai 7). Prisma 7 parked (needs explicit OK).
- Out of scope for launch: job feed, post-a-job, crypto payments, interview prep.

## Next session: Stripe live setup (with Jake at the computer, ~20 min)
Follow `docs/launch-audit.md` "What Jake must do" items 4 to 6:
1. Stripe live mode: products/prices $15/month and $29 one-time; put `sk_live_` key and
   both price ids in Vercel Production (Jake pastes secrets himself, never in chat).
2. Webhook `https://rework.hellojakejohn.com/api/stripe/webhook` on API version
   2026-02-25.clover with the 10 listed events; `whsec_` into Vercel.
3. Portal (only the $15 price, cancel at period end), checkout one-subscription setting.
4. Clear test billing data in the prod DB (SQL in the audit, counts first).
5. Redeploy, `/api/health` as admin must be `ok: true`.
6. One real $29 pass and one $15 subscription, then refund/cancel.
After that: Sentry + uptime monitor on `/api/health/live`, isolate the Preview env, then more
quality tuning (ideas above) until launch.

