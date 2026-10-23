# ReWork audit

Date: 2026-10-23. Scope: `main` at `2875679` (PR #6 launch merge) and PR #7 `origin/ai-providers` at `40a4d62` (read, not merged). Read-only: the only file written is this one.

How this was verified:

- Read every API route, `src/lib/*`, middleware, auth, schema and migrations on `main`, plus the full PR #7 diff (75 files).
- Ran on `main`: `npx tsc --noEmit` (clean), `npx vitest run` (19 files, 229 tests pass), `npx next lint` (fails: 16 errors, 1 warning), `npm audit --omit=dev`.
- Ran on a clean copy of PR #7 (`git archive` into the scratchpad, `npm ci`): `tsc` clean, 21 files, 282 tests pass.
- Checked the live public site (landing, pricing, sign-in, headers, robots, sitemap, `/api/health`, `/api/keepalive`).
- Checked the PR #7 model prices and API parameters against the Claude API reference.

Not verified (say so up front):

- Live ReWork database state. The Supabase MCP in this session is connected to the TripQuest project, not ReWork (`oxedndnmssyuffkfkcug`), so I could not confirm which migrations are applied or whether RLS is on.
- Anything behind sign-in on prod, and a local `npm run dev` (a hook blocks reading `.env`). UI findings for `/dashboard` and `/dashboard/tracker` come from code, not screenshots.
- Real model behavior and cost. `npm run eval:models` needs real keys and was not run.

Severity scale: Critical (fix before any real user), High (fix before launch), Medium (fix week 1), Low (backlog), Info.

---

## 1. Where we are

### Works end to end (by code and tests; not exercised live by me)

| Flow | Where |
| --- | --- |
| Google sign-in, database sessions | `src/lib/auth.ts` |
| Upload PDF/DOCX or paste, strict-schema parse, "is it in the file" validator, saved as master | `src/app/api/resumes/parse/route.ts`, `src/lib/parse-resume.ts`, `src/lib/parse-validate.ts` |
| Job URL resolver: ATS APIs, JSON-LD, page + model, needsPaste; SSRF-safe fetch | `src/lib/job-resolve/`, `src/lib/safe-fetch.ts` |
| Tailor with fact guard, keyword coverage, per-bullet accept/revert | `src/app/api/resumes/[id]/tailor/route.ts`, `src/lib/fact-guard.ts`, `src/lib/tailor-changes.ts` |
| Cover letter with prose fact guard, autosave edits | `src/app/api/resumes/applications/[id]/cover-letter/route.ts`, `src/lib/text-facts.ts` |
| Evidence interview (Pro): questions, answer-only rewrites, re-guarded apply | `src/app/api/resumes/[id]/evidence/*` |
| Tracker kanban, notes, follow-up dates | `src/app/api/tracker/*`, `src/components/tracker/` |
| PDF (Classic/Modern) and DOCX export (Pro) | `src/lib/resume-pdf.tsx`, `src/lib/resume-docx.ts` |
| Stripe checkout, portal, signed and idempotent webhook, stacked passes, refunds | `src/app/api/stripe/*`, `src/lib/stripe-sync.ts` |
| Entitlements as the single "is Pro" answer | `src/lib/entitlements.ts`, `src/lib/entitlement-rules.ts` |
| Download my data, delete my account (Stripe cancel first) | `src/lib/account.ts` |
| Admin analytics, comp Pro, daily ceilings, crons | `src/lib/admin-analytics.ts`, `src/lib/daily-ceiling.ts`, `vercel.json` |

The core is in better shape than most launch-stage apps: ownership checks are consistent, the webhook is correct, and SSRF handling is careful.

### Half-built

- **Email magic link**: there is no email provider anywhere. `src/lib/auth.ts:11-16` is Google only, and there is no Resend/nodemailer/EmailProvider in `package.json` or `src/`. Only the `VerificationToken` table exists (`prisma/schema.prisma:39`). Nothing to "run"; it was never built.
- **Feedback**: saved, but nobody is told and nothing reads it. `GET` returns 501 and the admin notification is a comment (`src/app/api/feedback/route.ts:67,87`). `/admin` has no feedback view.
- **Admin users table**: client-gated, light-themed table inside a dark app, shows the `PREMIUM` mirror instead of `Access` (`src/app/(app)/admin/page.tsx`). Server APIs are correctly gated.
- **PR #7 eval**: `scripts/eval-models.ts` exists, but `FREE_AI_CAP_USD` says "revisit once npm run eval:models has run on real keys" (`src/lib/plans.ts` on PR #7, line 64-67). Not yet done.
- **Landing example** is hand-built from a fixture, not real output (`STATE.md`, Known gaps).

### Dead code (no importers found by grep; safe to delete after a build check)

- Components: `src/components/download-button.tsx`, `src/components/pdf-thumbnail.tsx`, `src/components/resume-preview.tsx`, `src/components/loading/DashboardLoading.tsx`, `src/components/ui/{progress,tabs,switch,feedback-card}.tsx`.
- Routes only `pdf-thumbnail.tsx` called: `src/app/api/resumes/[id]/pdf/route.ts`, `src/app/api/resumes/[id]/url/route.ts`.
- Lib: `src/lib/date-utils.ts`. Model: `ResumeVersion` (`prisma/schema.prisma:126`, no use in `src/`).
- Old SQL outside Prisma: `migrations/add_avatar_selection.sql`, `migrations/resume_count_overhaul.sql`.
- Unused dependencies: `jspdf` (carries a critical advisory), `html2canvas`, `@stripe/stripe-js`.
- `src/components/ui/logo.tsx:58`: `variant="detailed"` points at `/rework-logo-detailed-cropped2.png`, which is not in `public/`. `BetaBadge` uses `secondary-500/600` classes that don't exist in `tailwind.config.ts`, so it renders unstyled.

### Drift between docs and reality

| Doc says | Reality |
| --- | --- |
| `TODO.md`: Stripe, rate limiting, Vercel deploy, tracker are TODO | All shipped. The file is from the project's first weeks. Delete or rewrite. |
| `STATE.md`: 3 migrations written, not applied | Could not verify (see top). If still true, every `track()` drops, daily ceilings fail open, and on PR #7 the AI cap fails open (`spentUsd` returns 0, `src/lib/ai-cap.ts:31-41`). |
| `CLAUDE.md:12` lists `src/lib/openai.ts` | PR #7 deletes it and doesn't update `CLAUDE.md`. |
| Main landing: "Unlimited tailoring" (`src/app/page.tsx:44`) | PR #7 policy is "never say unlimited" (`FAIR_USE`). PR #7 fixes the landing; fine once merged. |
| `STATE.md` checks: lint not listed | `npx next lint` fails with 16 errors; hidden by `ignoreDuringBuilds: true` (`next.config.ts:7`). |

---

## 2. Launch blockers (code and config only, ranked)

Your Anthropic key, Vercel Pro and Stripe prices are known; everything below is in addition.

1. **Confirm migrations are applied** (`20260928`, `20260929`, `20260930`, and PR #7's `20261002000000_ai_cap_overrides`). Without `events`, the AI cap and daily ceilings are off. Then run the RLS check query at the bottom of `prisma/migrations/20260927000000_enable_rls/migration.sql` (new tables `events` and `ai_cap_overrides` enable RLS themselves). *30 min.*
2. **Set `AI_FREE_TIER=anthropic:claude-sonnet-5-5` in Vercel.** Without it, FREE users run tailor/cover letter/evidence on Opus (`src/lib/ai/routing.ts:105-124` on PR #7: `resolveRoute` falls back to the task route) and the 75% downgrade does nothing. This is the settled decision, but it lives in env, not code. Consider defaulting it in code when `ANTHROPIC_API_KEY` is set. *5 min (env) or 30 min (code default + test).*
3. **Remove the `STRIPE_PRICE_PASS_30D` fallback** (`src/lib/stripe.ts` `stripePriceId()` and `fallbackEnv` in `src/lib/plans.ts`, PR #7). If `STRIPE_PRICE_PASS` is missing, checkout silently sells the old $15 price and the webhook grants 90 days (`PASS_DAYS = 90`). Same class of risk for `STRIPE_PRICE_PRO_MONTHLY`, whose env name didn't change: if it still points at the $9 price, the AI cap assumes $15 of revenue. Add a check in `/api/health` that fetches both Stripe prices and compares `unit_amount` to `PRO_MONTHLY_PRICE_USD` / `PASS_PRICE_USD`. *1 h.*
4. **Run `npm run eval:models` once on real keys** and check that a FREE month (1 parse + job extracts + 3 tailors + 1 letter) fits in `FREE_AI_CAP_USD = 0.5`. Parse and job extraction are not plan tasks, so FREE users run them on Opus (`PLAN_TASKS`, `src/lib/ai/routing.ts:32`). My rough estimate (unverified, from list prices $4/$20 Opus, $2/$10 Sonnet and typical resume sizes): an Opus PDF parse with thinking is $0.08 to $0.15, a Sonnet tailor $0.05 to $0.08. That puts a FREE month near $0.45 to $0.55, so FREE users could hit "AI paused" before their 3rd tailor. Also confirm the Opus to Sonnet refusal fallback is accepted: the array form `server-side-fallback-2026-06-01` exists, but I could not confirm Sonnet 5.5 is a valid array-form fallback target. *1-2 h, a few dollars.*
5. **Upgrade Next.js within 15.x** (`next` 15.3.8; `npm audit` lists critical/moderate advisories including middleware redirect SSRF and image-optimizer issues; fix at 15.5.x). Not Prisma, not `audit fix --force`. Run tests and a build after. Remove `jspdf`/`html2canvas` at the same time (critical advisories, unused). *1-2 h.*
6. **Fix lint to zero errors and turn `ignoreDuringBuilds` off** (`next.config.ts:7`). Most errors are in dead files that item 5's cleanup removes. *1 h.*
7. **Set `CRON_SECRET` in Vercel and make the crons fail closed.** Both cron routes skip the check when the secret is unset (`src/app/api/keepalive/route.ts:9`, `src/app/api/cron/expire-entitlements/route.ts:10`). Live `/api/keepalive` returns 401, so it is set today; the code should still refuse when it isn't. *10 min.*
8. **Merge PR #7 only after 1-4**, then update `CLAUDE.md` (openai.ts reference) and delete `TODO.md`.

Not blockers but close: security headers (Section 3, S6), the free-quota race (S3).

---

## 3. Security

Overall: no Critical findings. Every user-data route scopes by `session.user.id` (or by email on four older routes), and I found no path for user A to read or change user B's resumes, applications, cover letters or tracker cards.

### Authorization matrix (user A vs user B)

| Route | Check | Result |
| --- | --- | --- |
| `GET/PATCH/DELETE /api/resumes/[id]` | `findFirst({ id, userId, isActive })` (`route.ts:9-11`) | OK |
| `POST /api/resumes/[id]/tailor` | `resume.user.email === session.user.email` (`route.ts:69`); `applicationId` re-checked with `userId` (`:194`) | OK (by email, not id; see S9) |
| `GET /api/resumes/[id]/download` | `findFirst({ id, userId })`, application by `resumeId + userId` (`:40,48`) | OK |
| `/api/resumes/[id]/evidence/*` | `evidenceContext` ownership + Pro gate (`shared.ts:17`) | OK |
| `/api/resumes/applications/[id]` and `/cover-letter` and `/download` | `findFirst({ id, userId })` | OK |
| `/api/tracker/[id]` PATCH/DELETE | `findFirst`/`deleteMany` with `userId` | OK |
| `POST /api/tracker` `resumeId` | Only used if `userId` matches (`:89`) | OK |
| `POST /api/resumes/parse` `replaces` | `updateMany({ id, userId })` (`:179`) | OK |
| `/api/resumes/[id]/pdf` and `/url` | By email then `userId` | OK (dead code) |
| `/api/admin/*`, `/api/health` | `isAdminEmail` server-side | OK |
| `/api/account`, `/api/account/export` | session user only | OK |

### Findings

| # | Severity | Finding | Where | Fix |
| --- | --- | --- | --- | --- |
| S1 | High | **Migrations / fail-open money guards.** Daily ceilings (`src/lib/daily-ceiling.ts:36-38`) and the PR #7 AI cap (`src/lib/ai-cap.ts:38-40`) fail open when `events` can't be read. Intentional, but combined with an unapplied `events` migration there is no spend guard except the per-lambda rate limit. | as listed | Blocker 1. Optionally fail closed for FREE users only. |
| S2 | Medium | **Stripe price not tied to the grant.** `grantPassFromCheckout` grants `PASS_DAYS` for any `mode: payment` session and `syncSubscription` grants Pro for any subscription on the customer. No check that the price id is ours/current. Only exploitable through misconfigured env or a stray Stripe product, but that is exactly blocker 3. | `src/lib/stripe-sync.ts:107-147, 41-104` | Accept only the configured price ids (store `stripePriceId` and compare). |
| S3 | Medium | **Quota race (cost).** Monthly quota is read before the model call and incremented after (`tailor/route.ts:90-100, 221`; `cover-letter/route.ts:75, 129`). N parallel requests from a FREE user all pass. The in-memory rate limit is per lambda (`src/lib/rate-limit.ts:1-3`), so it doesn't stop this. Bounded by the daily ceiling (20/day on PR #7) and the AI cap, so the loss is cents per abuser, not dollars. | as listed | Reserve atomically before the call: `updateMany({ where: { id, monthlyTailors: { lt: limit } }, data: { increment: 1 } })`, refund on failure. |
| S4 | Medium | **Unbounded prompt inputs.** `extraContext`, `contextTags`, `jobTitle`, `company`, `location` on tailor have no length cap (`tailor/route.ts:48-58`); only the description is capped. Large `extraContext` raises token cost and is a prompt-injection channel into the tailor (the fact guard still blocks invented facts, which is the right backstop). | `src/app/api/resumes/[id]/tailor/route.ts:48` | Clip to 200/200/200/1000 chars, `contextTags` to 10 x 40. |
| S5 | Medium | **Open redirect after sign-in.** The `redirect` callback returns any off-site `url` unchanged (`src/lib/auth.ts:21-27`). NextAuth's default is to refuse off-site URLs. Exploitability is low here because the sign-in button hardcodes `/dashboard` (`signin/page.tsx:60`), but it's a one-line fix. The same callback also throws away same-origin deep links (`/dashboard/tracker` becomes `/dashboard`). | `src/lib/auth.ts:21-27` | Return `url` if same-origin, `url` if it starts with `/`, else `baseUrl + '/dashboard'`. Pass `callbackUrl` through on the sign-in page. |
| S6 | Medium | **No security headers.** Live response has HSTS only: no CSP, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`. The dashboard can be framed (clickjacking on Delete account / Checkout). | `next.config.ts` (no `headers()`) | Add `headers()` with `frame-ancestors 'none'`, `nosniff`, `strict-origin-when-cross-origin`; CSP in report-only first. |
| S7 | Medium | **Dependency advisories.** 22 (4 critical, 14 high). Critical: `next` (fix in 15.5.x), `jspdf` (unused), `form-data` (transitive), `next-auth` (the critical one is Email-provider normalization, which we don't use; still upgrade within 4.24.x). | `package.json` | Blocker 5. |
| S8 | Low | **LinkedIn via redirect (main only).** On `main`, `BLOCKED_SITES` is checked on the first URL only (`src/lib/job-resolve/index.ts:61`); a shortener redirecting to linkedin.com would be fetched. PR #7 adds `checkUrl: refuseLinkedIn` on every hop. Settled decision holds once PR #7 merges. | as listed | Merge PR #7. |
| S9 | Low | **Mixed identity keys.** Four routes look up the user by email (`tailor/route.ts:35,69`, `feedback/route.ts:44`, `pdf/route.ts:23`, `url/route.ts:23`), the rest by `session.user.id`. Safe today (Google emails are verified, `users.email` is unique) but inconsistent. | as listed | Use `session.user.id` everywhere. |
| S10 | Low | **Upload checks trust extension/MIME.** `kindOf` accepts any file named `.pdf`/`.docx` (`parse/route.ts:33-38`); the parser then fails on garbage, so the impact is a wasted parse. Storage key takes the extension from the user filename (`src/lib/storage.ts:149-151`). | as listed | Check `%PDF-` / `PK` magic bytes; derive the extension from the detected kind. |
| S11 | Low | **Storage bucket created lazily** with a 10 MB limit and `.doc` allowed (`src/lib/storage.ts:21-47`), and `listBuckets` runs on every upload (`:59`). | as listed | Create the bucket once by hand (4 MB, PDF/DOCX only), delete `ensureBucketExists`. |
| S12 | Low | **Prisma logs every query in production** (`src/lib/prisma.ts:8`). No parameters in stdout mode, but noisy and it leaks table/field shape into Vercel logs. | `src/lib/prisma.ts:8` | `log: process.env.NODE_ENV === 'development' ? ['query'] : ['error']`. |
| S13 | Low | **Admin CSV injection.** Names are wrapped in quotes but not escaped; a Google name starting with `=` executes in Excel; a `"` breaks the row. | `src/app/api/admin/users/export/route.ts:57` | Escape `"` and prefix `= + - @` with `'`. |
| S14 | Low | **Crons fail open without `CRON_SECRET`** (blocker 7). | cron routes | Refuse when unset. |
| S15 | Low | **Account farming.** Each Google account gets a fresh FREE quota and $0.50 AI cap; delete-and-rejoin resets counters (`src/lib/account.ts:168`). Cost ceiling per account is small. | as listed | Watch `signed_up` vs `limit_hit` in /admin; act only if it shows up. |
| S16 | Info | **Self-XSS via `jobUrl`.** Tailor stores `jobUrl` unvalidated (`tailor/route.ts:216`) and the tracker renders it as `href` (`src/components/tracker/tracker-card.tsx:134`). Only the owner sees it, and React 19 blocks `javascript:` URLs. | as listed | Apply the tracker's `^https?://` check in tailor too. |
| S17 | Info | `/admin` page shell returns 200 to anyone; data APIs are gated. | `src/app/(app)/admin/page.tsx` | Optional server-side gate. |

### Areas checked and found sound

- **Auth/session**: NextAuth v4 database sessions; middleware only checks cookie presence for redirects and every route re-validates with `getServerSession` (`src/middleware.ts:4-10`). Correct pattern for DB sessions.
- **RLS vs Prisma**: Prisma connects as the table owner and bypasses RLS; RLS with no policies only closes Supabase's REST/GraphQL API (`prisma/migrations/20260927000000_enable_rls/migration.sql`). No anon key is used anywhere in `src/` (only `NEXT_PUBLIC_SUPABASE_URL`), and the service role key is server-only (`src/lib/storage.ts:8`). Correct, pending blocker 1.
- **Stripe webhook**: signature verified on the raw body, event-id idempotency table, handlers re-fetch from Stripe and take a per-user advisory lock (`src/app/api/stripe/webhook/route.ts:29-61`, `src/lib/stripe-sync.ts:10-15`). One edge: a 100%-off promo code gives `payment_status: 'no_payment_required'`, which `grantPassFromCheckout` skips (`stripe-sync.ts:108`). Only matters if you hand out 100% codes; use comps instead.
- **SSRF**: http(s) only, no credentials, every resolved IP checked at connect time (DNS rebinding safe), IPv4/IPv6/mapped/NAT64/6to4 blocked, redirects re-validated, timeout and decompressed size cap (`src/lib/safe-fetch.ts`). Good work. Minor gap: Teredo `2001::/32` is not in the IPv6 list.
- **Upload limits**: 4 MB file, 30k pasted chars, 20k job description (`src/lib/plans.ts:37-41`), checked server-side.
- **Secrets in client bundles**: no `process.env` reads in `"use client"` files; only `NEXT_PUBLIC_SUPABASE_URL` is public.
- **PII**: resumes stay in Postgres and a private bucket; downloads are `no-store`; `track()` props exclude text and names (`src/lib/track.ts:5-6`); account deletion cancels Stripe first and cascades (`src/lib/account.ts:120-172`). PR #7 keeps resume text on paid first-party providers only and never crosses providers on refusal (`src/lib/ai/routing.ts:11-14`, `src/lib/ai/adapters/anthropic.ts:11-14`). Privacy page should name Anthropic as a processor before PR #7 ships (PR #7 edits `src/app/privacy/page.tsx`; re-read the final text).
- **Admin**: allowlist by Google email, server-side on every admin API (`src/lib/admin.ts`). Hardcoded defaults are your two addresses; fine.

---

## 4. Quick wins (under an hour each)

| # | Win | Why | Where |
| --- | --- | --- | --- |
| Q1 | Replace the 507 KB `favicon.ico` and use a square icon | 507 KB favicon on every first visit; the PNG icon is 415x371 (not square), so iOS crops it | `src/app/favicon.ico`, `src/app/layout.tsx:24-27` |
| Q2 | Remove the `/grid.svg` background | File doesn't exist: a 404 on every sign-in load | `src/app/(app)/auth/signin/page.tsx:27` |
| Q3 | Render the Google button without `getProviders()` | Sign-in shows a spinner for 1-3 s before the only button appears (seen live) | `src/app/(app)/auth/signin/page.tsx:15-22` |
| Q4 | Sign-in copy: "Sign in to start optimizing your resumes with AI" | Generic AI copy; off-brand. Try "Sign in. Your resume stays yours, and nothing gets made up." | `signin/page.tsx:37` |
| Q5 | Keep deep links through sign-in | `/dashboard/tracker` and `?application=` links land on `/dashboard` | `src/lib/auth.ts:21-27` (with S5) |
| Q6 | Cache `getAccess` in the session callback | Every `useSession` refetch runs 3 queries (user, job count, entitlements) | `src/lib/auth.ts:28-67` |
| Q7 | Security headers | Clickjacking and sniffing protection in 10 lines | `next.config.ts` (S6) |
| Q8 | Delete dead code and unused deps | Smaller install, fewer advisories, lint closer to zero | Section 1 list |
| Q9 | Show the fact guard's work on the landing | "Nothing made up" is a claim; a before/after with a struck-through invented metric proves it | `src/app/page.tsx`, `src/components/site/landing-example.ts` |
| Q10 | Pricing page header: link back to `/` and add the site footer | Pricing has its own header with no nav back and no footer (seen live) | `src/app/(app)/pricing/page.tsx:20-24` |
| Q11 | Feedback email | Feedback goes into a table nobody reads | `src/app/api/feedback/route.ts:67` |
| Q12 | Sitemap: drop `changefreq`/`priority`, add `lastModified` | Google ignores the first two | `src/app/sitemap.ts` |
| Q13 | Default `AI_FREE_TIER` in code | Removes blocker 2 as a config risk | `src/lib/ai/routing.ts:105` (PR #7) |

---

## 5. Product gaps vs competitors

Competitor features are from my general knowledge (to mid-2026), not re-checked this session. Verify pricing before quoting it publicly.

| Expectation | Teal | Huntr | Jobscan | Rezi | ReWork |
| --- | --- | --- | --- | --- | --- |
| Tailor resume to a job | Yes | Yes | Yes | Yes | Yes |
| Fact-checked rewrites (no invented metrics) | No | No | No | No | **Yes, enforced** |
| Ask for real numbers instead of guessing | No | No | No | Partial | **Yes (evidence interview)** |
| Match score / keyword report | Yes | Yes | **Core product** | Yes | Coverage % and missing keywords |
| Browser extension (save job from any site, LinkedIn included) | Yes | Yes | Yes | Partial | **No** |
| Tracker | Yes | **Core product** | Yes | Partial | Yes (kanban) |
| Contacts / networking CRM | Yes | Yes | No | No | No |
| Multiple templates | Many | Some | Some | Many | 2 (Classic, Modern) |
| Resume builder from scratch | Yes | Yes | No | Yes | Needs an existing resume |
| LinkedIn profile optimization | Yes | No | Yes | No | No |
| Interview prep | Some | Some | No | Some | No (out of scope by `STATE.md`) |
| Pay once for a job hunt | No (subscription) | No | No | Lifetime tier | **Yes ($29 for 90 days, PR #7)** |

What a job seeker will miss first, in order:

1. **Save a job without copy-paste.** LinkedIn is the biggest source of postings and is never fetched server-side (settled). A browser extension that reads the page the user already has open respects that decision: the user's browser reads it, not our server. Biggest gap.
2. **A clear match score before and after.** Coverage % exists (`categoryScores`), but Jobscan has trained users to expect a headline score. Show "Before 42%, after 78%, 3 keywords we couldn't add honestly" on the Result card. The third part is the differentiator.
3. **More templates** (one more serif and one compact).
4. **Follow-up reminders** (the tracker stores `followUpAt` but nothing sends a reminder).

What is genuinely differentiated:

- **The fact guard is real**, deterministic, and runs after the model (`src/lib/fact-guard.ts`, `src/lib/text-facts.ts`, re-checked on evidence apply in `evidence/apply/route.ts:30-39`). No competitor makes that promise. "The resume tailor that won't lie for you" is defensible.
- **The evidence interview** turns the guard's limitation (no metrics to add) into a feature (ask for them).
- **Pass pricing** fits how people actually job hunt.
- **Missing keywords you don't have** is honest output competitors hide. Lean into it.

---

## 6. Consistency and brand

### UI audit (from code; live check of `/`, `/pricing`, `/auth/signin`)

| Area | Finding | Where |
| --- | --- | --- |
| Color tokens | Two conflicting systems. `globals.css` `:root` says background `#020817` (slate-950); `tailwind.config.ts` hardcodes `background: '#0A0A0B'`. Components ignore both and use raw `bg-slate-*` (12x `bg-slate-950`, 13x `bg-slate-700`, ...) plus `bg-gray-*` and `bg-white` on admin. | `src/app/globals.css:13-34`, `tailwind.config.ts:14-50`, `src/app/layout.tsx:36` |
| Accent | Emerald is the action color (104 uses), but amber (34), cyan (25), purple (17), blue (9), indigo (4) all appear. The logo is a blue to purple gradient, which matches none of it. | grep tally; `public/rework-logo-simple-cropped.png` |
| Type | Inter via `next/font` in `layout.tsx`, but `tailwind.config.ts` sets `-apple-system, SF Pro Display, Inter`. 12 arbitrary sizes (`text-[11px]` x16, `text-[13px]` x12, `[9px]`..`[26px]`) next to the Tailwind scale. | `src/app/layout.tsx:2,7`, `tailwind.config.ts` fontFamily |
| Buttons | 44 raw `<button>` vs 16 `<Button>`; the flow has its own `SecondaryButton` (`src/components/flow/ui.tsx`). Primary button text is `text-slate-950` 6 times and `text-white` once on the same emerald. | grep tally |
| Radii | `rounded-lg` 68, `rounded-md` 40, `rounded-xl` 15, `rounded` 17, `rounded-2xl` 4 for similar cards. | grep tally |
| Logo usage | Public header: raw `<Image>` 28px + text. App header and pricing: `<Logo size="xs">` (48px box) + text at different sizes (`text-[15px] font-semibold` vs `text-xl font-bold`). Sign-in: 160px logo, no wordmark. | `src/components/site/site-header.tsx:8-11`, `src/components/flow/app-header.tsx:67-68`, `src/app/(app)/pricing/page.tsx:22-23`, `signin/page.tsx:33` |
| Page shells | Sign-in has no header/footer and a `gray-900` to black gradient; pricing has its own header; landing/legal use `SiteHeader`/`SiteFooter`; admin is light-themed. | as listed |
| Empty states | Good in the flow and evidence interview; tracker columns say "Nothing here yet." (fine); Recent drawer and admin have none. | `src/components/tracker/tracker-view.tsx:267` |
| Copy tone | Landing, plans and errors are plain and honest ("Nothing made up", limit messages that explain). Outliers: sign-in "optimizing your resumes with AI", feedback card "gradient-text Help Improve ReWork", main landing "Unlimited". | `signin/page.tsx:37`, `src/components/ui/feedback-card.tsx:23`, `src/app/page.tsx:44` |

### Three brand directions

All three keep the name ReWork (it's on the domain and in Google OAuth). They differ in what the brand promises visually.

**A. "Receipts" (recommended)**
- Name treatment: `ReWork` in a sturdy grotesk, with a small checkmark or underline under "Work" that reads as "verified".
- Logo concept: a document with a single green check in the margin, like a proofread page. No circuits, no gradient: AI is the engine, not the brand.
- Palette: ink `#0B0F14` background, paper `#F5F3EE` for document surfaces, one verification green `#2FBF71` for actions and "checked" states, one red-orange `#E5533D` reserved for "removed, not in your resume". Slate neutrals in between.
- Type: Inter Tight or Geist for UI; Source Serif 4 for resume previews and big claims.
- Voice: plain, specific, a little dry. "We cut 2 numbers that weren't in your resume." Show the work.
- Rationale: "won't lie for you" is a trust claim, and trust is earned by showing evidence. A brand built around the check mark and the red strike-through turns the fact guard into the visual identity: every screen that shows a removed claim is an ad for the positioning. It also fits the existing emerald action color, so the change is evolutionary.

**B. "Plain paper"**
- Name: lowercase `rework` in a serif.
- Logo: a folded page corner.
- Palette: light-first, warm off-white, black text, a single blue link color.
- Type: a serif for headings (Newsreader), a neutral sans for UI.
- Voice: calm, editorial, like a good career coach.
- Rationale: honesty as craft. Feels human and anti-hype next to AI tools that shout. Costs more: the app is dark everywhere today, so this is a full re-theme.

**C. "Straight talk"**
- Name: `ReWork` heavy, all-caps option for social.
- Logo: a speech mark or a ruler (measure, don't inflate).
- Palette: near-black with a high-contrast yellow accent.
- Type: a condensed grotesk for headlines, Inter for UI.
- Voice: blunt and funny. "Your resume, minus the made-up stuff."
- Rationale: stands out in a crowded, polite category and works on social. Risk: blunt can read as unserious to career changers and anxious job seekers, who are the core user.

**Recommendation: A.** It is the closest to what's built, it makes the fact guard visible, and it suits anxious users who need to trust the output enough to send it.

### What a rebrand touches in code

- Tokens: one source of truth. Delete the hardcoded colors in `tailwind.config.ts:14-50`, map Tailwind to CSS variables in `src/app/globals.css`, add `success`/`removed` semantic tokens.
- Components: `src/components/ui/button.tsx` (make it the only button, add a variant for the flow's `SecondaryButton`), `src/components/ui/logo.tsx` (one SVG logo + wordmark, drop PNGs and `BetaBadge`), `src/components/site/site-header.tsx`, `src/components/flow/app-header.tsx`, `src/app/(app)/pricing/page.tsx` (use `SiteHeader`), `src/app/(app)/auth/signin/page.tsx`, `src/app/(app)/admin/page.tsx`.
- Fact-guard UI: removed/flagged states in `src/components/flow/result-card.tsx` and the Changes view, which become the brand's signature element.
- Fonts: `src/app/layout.tsx` (`next/font`), `tailwind.config.ts` fontFamily; PDF/DOCX fonts stay as they are (`src/lib/resume-pdf.tsx`, `src/lib/resume-docx.ts`): exports must stay ATS-neutral, not branded.
- Assets: `public/og-image.svg` + `scripts/generate-og-image.js` (regenerate `og-image.png`), `src/app/favicon.ico`, an `apple-icon.png` (square), `src/app/layout.tsx` icons.
- Emails: none exist yet. Stripe receipts and the Customer Portal take brand color and logo in the Stripe dashboard (not code). Google OAuth consent screen logo is in Google Cloud console.
- Copy: `src/lib/plans.ts` (all pricing copy), `src/app/page.tsx`, `src/app/layout.tsx` metadata.
- Effort: about 2-3 days for A, 4-5 days for B or C.

---

## 7. $WORK token design (post-launch, after paying users)

Design only. Nothing here should ship before Stripe revenue exists and a lawyer has reviewed it.

### How it plugs in

The entitlement model was built for this. `TOKEN_HOLD` and `TOKEN_PAYMENT` are already in the enum (`prisma/schema.prisma:244-245`, `src/lib/entitlement-rules.ts:10-11`), and `src/lib/entitlements.ts:4-6` says the plan: a verifier upserts rows with those sources and calls `refreshPlanMirror()`. Feature code doesn't change.

- **TOKEN_HOLD**: one row per (user, wallet). `externalId = <chain>:<address>`, `status ACTIVE`, `endsAt = lastVerifiedAt + recheckWindow` (for example 26 h). The row stops granting Pro on its own if re-checks stop, because `isLive()` already ignores rows past `endsAt` (`entitlement-rules.ts:68-79`). No new state machine needed.
- **TOKEN_PAYMENT**: one row per on-chain payment. `externalId = <chain>:<txHash>` (the existing `@@unique([source, externalId])` makes it idempotent, like Stripe), `startsAt/endsAt` from `passWindow()` exactly like a Stripe pass, so token passes stack with card passes.
- **AI cap (PR #7) needs a change before tokens ship.** `capPeriod()` treats any non-Stripe live row as "comp" and gives it Pro Monthly's revenue cap (`src/lib/ai-cap-rules.ts:86-89` on PR #7). A holder pays us nothing per month, so a holder would get about $10/month of Opus for free, forever. Add explicit branches: TOKEN_PAYMENT uses the USD value actually received (after the 50% discount and the burn), TOKEN_HOLD gets a fixed cap you choose, and likely runs on `AI_FREE_TIER`.
- New table `wallets` (userId, chain, address, verifiedAt, signature nonce), RLS on, cascade on user delete.

### Wallet connect and verification

- Sign-In-With-Ethereum style (EIP-4361) message signed by the wallet, or the Solana equivalent, with a server nonce, domain and expiry. Verify the signature server-side, store the address. Never ask for a private key or seed; never custody funds.
- One wallet links to one user. Reject an address already linked elsewhere (prevents one wallet unlocking Pro on many accounts).
- Keep wallet code out of the main bundle: a separate `/wallet` page and dynamic imports (the landing currently ships no auth JS; keep it that way).

### Price oracle / TWAP for the 50% discount

- Quote in USD, settle in $WORK. Price = TWAP from the deepest DEX pool (Uniswap v3 `observe()` over 30 min, or the chain's equivalent), cross-checked against a second source (Chainlink feed if one exists, else a second pool). Refuse to quote if the two disagree by more than 5% or pool liquidity is below a floor.
- Quote is valid for 10 minutes and names the exact amount and receiving address; the payment must match within that window. Underpayment grants nothing (or is refunded manually); overpayment is kept.
- Thin liquidity is the main risk: a manipulated spot price buys Pro for nothing. TWAP + liquidity floor + a USD cap on daily token-paid passes per user bound it.

### Re-checking holdings

- Daily cron (next to `expire-entitlements` in `vercel.json`) reads balances for all linked wallets via RPC multicall, extends `endsAt` for holders above threshold, lets the rest lapse.
- Use a snapshot over time, not a point read: require the balance to have been held for 24-72 h (check balance at several block heights, or a minimum hold before first grant). This blocks flash-loan and "borrow, verify, return" tricks.
- Show "Pro via $WORK, re-checked daily" in `describeAccess()` (`entitlement-rules.ts:161-179` has a `default` branch for this).

### 50% burn, 50% treasury

- Do the split on-chain in a small, audited contract the user pays into, so the burn is verifiable and not a promise. The app only watches for the contract's event, keyed by tx hash.
- Admin analytics: record USD value at payment time on the event so MRR/pass revenue in `/admin` stays honest.

### Abuse cases

| Case | Mitigation |
| --- | --- |
| Borrow tokens, verify, return | Hold duration across block heights; daily re-check |
| One wallet, many accounts | Unique (chain, address) across users |
| Many wallets, one person | Not preventable; each needs the full threshold, which is the point |
| Price manipulation to pay less | TWAP, two sources, liquidity floor, quote window |
| Reorg / double-spend | Wait N confirmations before granting; idempotent `externalId` |
| Wash trading to set the price | Same TWAP and floor; cap token-paid passes per day |
| Holder AI cost with no revenue | Explicit TOKEN_HOLD cap and free-tier model (above) |
| Refund requests in tokens | Policy: no refunds for token payments, said before payment |

### Legal and positioning risks

- **Securities**: a token whose value is pitched as rising because of burns and a treasury can look like an investment contract. Never market price, burns or "deflation" as upside to users. Get counsel before launch, especially as an individual operator (`STATE.md`: Saint Paul, MN).
- **Money transmission / tax**: accepting tokens as payment is income at fair value; sales tax may apply as with card payments. Keep USD value per payment.
- **Sanctions**: screen addresses (OFAC) at link and payment time.
- **Payment processor terms**: keep token flows fully separate from Stripe; check Stripe's restricted-business list so the card account isn't put at risk.
- **Positioning**: "The resume tailor that won't lie for you" is a trust brand. Crypto carries scam associations for many job seekers. Keep $WORK off the landing, pricing and onboarding; make it an opt-in page for people who already hold it. If it ever conflicts with trust, drop it.

---

## 8. Ranked roadmap

Effort is focused solo time.

### Launch-critical

| Item | Effort |
| --- | --- |
| Confirm migrations applied; RLS check query (blocker 1) | 0.5 h |
| `AI_FREE_TIER` set or defaulted in code (blocker 2) | 0.5 h |
| Remove pass price fallback; Stripe price check in `/api/health` (blocker 3, S2) | 1-2 h |
| `eval:models` on real keys; check FREE cap and refusal fallback (blocker 4) | 1-2 h |
| Next 15.5.x, remove unused deps, delete dead code, lint to zero (blockers 5-6) | 2-3 h |
| Crons fail closed (blocker 7) | 10 min |
| Security headers (S6) | 0.5 h |
| Merge PR #7, update `CLAUDE.md`, delete `TODO.md`, re-read privacy page (Anthropic named) | 1 h |
| Smoke test on prod: sign in, upload, URL, tailor, letter, download, buy pass in Stripe test mode, refund | 1-2 h |

### Week 1 after launch

| Item | Effort |
| --- | --- |
| Atomic quota reservation (S3) | 2 h |
| Input caps on tailor fields (S4) | 0.5 h |
| Redirect callback + deep links (S5, Q5) | 0.5 h |
| Sign-in page: no spinner, no 404, new copy (Q2-Q4) | 1 h |
| Favicon / apple icon (Q1) | 0.5 h |
| Feedback email to you (Q11) | 1 h |
| `session` callback query cut (Q6) | 1 h |
| Stripe: accept only configured price ids (S2) | 1 h |
| Watch /admin daily: funnel, `ai_error`, `limit_hit`, AI spend by model | ongoing |

### Month 1

| Item | Effort |
| --- | --- |
| Brand direction A: tokens, Button, logo, headers, OG, favicon | 2-3 days |
| Match score before/after with "keywords we couldn't add honestly" on the Result card | 1-2 days |
| Real `eval:tailor` output on the landing (Q9) | 0.5 day |
| Follow-up reminder emails from `followUpAt` (needs an email provider) | 1-2 days |
| Admin: server-gated page, feedback view, users table on `Access` | 1 day |
| Durable rate limit (Upstash or Postgres) if `limit_hit`/abuse shows in /admin | 0.5-1 day |
| One more resume template | 1-2 days |

### Later

| Item | Effort |
| --- | --- |
| Browser extension: save the open job page (LinkedIn included, read client-side) | 1-2 weeks |
| Email magic link (optional; Google-only may be fine) | 1 day |
| Prisma 7 (needs your explicit OK) | 0.5-1 day |
| $WORK token (Section 7), after paying users and legal review | 2-4 weeks incl. contract audit |
| LinkedIn profile suggestions (fact-guarded) | 1 week |
