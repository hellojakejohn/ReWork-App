# rework launch audit (Nov 6, 2026)

Branch `launch-audit`, on top of `rebrand` -> `launch-blockers` -> `ai-providers` -> `main`.
Audited 2026-10-27 with five parallel code reviews (auth/data, uploads/job links, AI layer
and cost cap, Stripe, exports/launch basics), a live check of production and the local
build, and offline tests for every claim. Nothing here used API keys, live Stripe or the
production database (the only Supabase connectors on this machine point at other projects).

**Verdict: GO for Nov 6, conditional on the "Jake must do" list below.** No Critical
finding was open at the end of this pass. Before the fixes there were 9 Highs: 8 are fixed
in code on this branch, and one (error alerting) needs a Sentry account Jake has to create.
The rest are Medium/Low and safe to ship with, or dashboard steps only Jake can do.

## Build health

| Check | Result |
| --- | --- |
| Merge order | Linear: `main` is an ancestor of `ai-providers`, which is an ancestor of `launch-blockers`, which is an ancestor of `rebrand`, which is an ancestor of `launch-audit`. No conflicts possible. PRs: [#7](https://github.com/hellojakejohn/ReWork-App/pull/7), [#8](https://github.com/hellojakejohn/ReWork-App/pull/8), [#9](https://github.com/hellojakejohn/ReWork-App/pull/9), none merged. |
| `npx tsc --noEmit` | Clean |
| `npm test` | 681 passed, 46 files (321 before this audit; 360 new audit tests) |
| `npx next lint` | 0 errors, 1 old warning (`feedback-context.tsx:52` unused var) |
| `npm run build` | Passes. PDF fonts are traced into both download functions. |
| Client bundle | No `sk_`, `sk-ant-`, `whsec_`, `service_role` or JWTs in `.next/static`. The only `NEXT_PUBLIC_` var is the Supabase URL. |

Gap tests: each audit test file keeps `it.fails` tests for gaps still open (they pass
while the gap exists and start failing when someone fixes it). The fixed ones were flipped
to plain `it` in the same commit as the fix.

## Findings

Status: **Fixed** (commit on this branch), **Jake** (dashboard or account step), **Open**
(known, shipping with it), **Decide** (product call).

### Critical

None.

### High

| # | Area | Finding | Where | Status |
| --- | --- | --- | --- | --- |
| H1 | Fact guard | The receipt says "Invented: 0", but bullets could borrow a number from another job, the summary or the graduation year ("team of 6" when 6 is years of experience). "Doubled", "twenty percent" and "$8 million" (borrowing the 8) passed, and so did a new employer, tool, title or certification named inside a bullet. | `src/lib/fact-guard.ts`, `src/lib/resume-text.ts` | Fixed `ecfe263` |
| H2 | AI cost | No global spend ceiling or kill switch: launch-day signups or account farming were bounded only by the Anthropic balance. | `src/lib/ai-cap.ts` | Fixed `242ed78`: `AI_DISABLED`, and `AI_FREE_DAILY_USD` (default $25/day, free accounts only; paid users are covered by their own 0.70 x revenue cap) |
| H3 | AI cost | The cap failed open: if `events` couldn't be read, a FREE user at 1000% ran as if new. | `src/lib/ai-cap.ts` | Fixed `242ed78` (FREE fails closed, paid fails open) |
| H4 | AI cost | Parallel requests all passed the cap check, because spend is written after each call. A FREE user at 98% firing 20 parses could spend about $8 on a $0.50 cap; Pro could overshoot about $38. | `src/lib/ai-cap.ts`, routes | Fixed `242ed78`: at most 2 model calls per user in flight (`src/lib/ai-inflight.ts`). Worst overshoot is now about 2 calls (about $0.75). |
| H5 | AI layer | The SDK timeout (600s x 3 attempts) outlived `maxDuration` 300. A slow Opus call was killed before the route released the FREE quota or logged the spend. | `src/lib/ai/adapters/anthropic.ts:70` | Fixed `242ed78`: every call gets the time left before the route's deadline, no SDK retry |
| H6 | AI layer | The Opus 5.5 -> Sonnet 5.5 refusal fallback target was never verified, and `/api/health` pinged without it. If Anthropic rejects it, every Opus call 400s. | `src/lib/ai/models.ts`, `src/lib/ai/health.ts` | Fixed the check `1e1ae1b` (health now sends the production shape on Opus). **Jake**: open `/api/health` in prod after deploy and confirm `ai.anthropic.ok` |
| H7 | Exports | PDFs used the non-embedded Times/Helvetica (WinAnsi), so "Trần Nguyễn", "Dvořák", "Łódź" came out garbled in the file an employer opens. The in-app preview looked fine. | `src/lib/resume-pdf.tsx:12` | Fixed `f329717`: embedded Tinos/Arimo (metric twins, same look). CJK and emoji still not covered (Low). |
| H8 | Exports | react-pdf hyphenated words across lines ("migra-/tion", "cross-func-/tional"), which breaks ATS keyword matching. | `src/lib/resume-pdf.tsx` | Fixed `f329717` |
| H9 | Ops | No error monitoring. A 500 outside the AI routes reached only the short-lived runtime log; nobody would know prod broke until a user emailed. | n/a | Partly fixed `59379c6` (server errors and webhook failures land in `/admin`), plus a public `/api/health/live` for an uptime monitor `6e9d8f3`. **Jake**: alerts need Sentry and an uptime monitor (below). |

### Medium

| # | Area | Finding | Where | Status |
| --- | --- | --- | --- | --- |
| M1 | Stripe | Test-mode `cus_` ids left in the prod DB 500 every checkout and portal call after switching to `sk_live_`. | `src/app/api/stripe/checkout/route.ts`, `portal/route.ts` | Fixed `f2d6c50` (stale ids are replaced). **Jake**: still clear test entitlements before going live (SQL below). |
| M2 | Stripe | Nothing checked that the live webhook endpoint exists, has the events, or matches the SDK API version. A wrong `whsec_` means people pay and never get Pro. | `src/app/api/health/route.ts` | Fixed `f2d6c50` (`checks.stripeWebhook`, price mode vs key mode) |
| M3 | Stripe | Disputes not handled: the buyer kept 90 days of the pass and Jake paid the dispute fee. | webhook | Fixed `f2d6c50` (`charge.dispute.created` stops the pass) |
| M4 | Stripe | API version drift: the SDK pins `2026-02-25.clover`; the endpoint is reportedly on `2026-08-26.dahlia`. Every field the code reads exists in both shapes today (tested), but drift is untested by design. | `src/lib/stripe.ts:11` | **Jake**: create the live endpoint on `2026-02-25.clover` (health now flags a mismatch) |
| M5 | Stripe | Two open Pro checkouts could both be paid (two subscriptions). | checkout | Narrowed `f2d6c50` (sessions expire after 30 min). **Jake**: turn on Stripe's "limit customers to one subscription" checkout setting. |
| M6 | Stripe | The portal could let a subscriber switch to another price and keep Pro. | `src/lib/stripe-sync.ts:82` | **Jake**: portal products list only the $15 price, or plan switching off |
| M7 | Stripe | No sales tax (`automatic_tax` off). | checkout | **Decide** |
| M8 | Auth | Cross-site writes from any `*.hellojakejohn.com` page counted as same-site for SameSite=Lax. | `src/middleware.ts` | Fixed `6e9d8f3` (Origin check on non-GET `/api/*`) |
| M9 | Input | `PATCH /api/resumes/[id]` accepted a 3 MB master, which then fed every prompt. Evidence rewrite took unlimited client text into the prompt. | `src/app/api/resumes/[id]/route.ts`, `evidence/rewrite/route.ts` | Fixed `6e9d8f3` |
| M10 | Config | Preview deployments: if Preview shares prod's `NEXTAUTH_URL`, `DATABASE_URL` and live keys, a preview build is a second prod. Google sign-in on previews breaks either way. | Vercel env | **Jake**: Preview scope gets its own DB and test keys, or turn on Deployment Protection |
| M11 | Uploads | Names with decomposed accents (macOS text, some DOCX) were dropped as "not in your file". | `src/lib/parse-validate.ts:9` | Fixed `2070cfc` |
| M12 | Job links | With the model unavailable (AI paused, failed), any page text, even a news article or a soft 404, became "the job". | `src/lib/job-resolve/index.ts:122` | Fixed `2070cfc` (page used only if it reads like a job ad) |
| M13 | Job links | Workday `/details/` URLs fell through to "paste it". | `src/lib/job-resolve/ats.ts:84` | Fixed `2070cfc` (URL shape unverified against a live Workday tenant) |
| M14 | Job links | Greenhouse embedded on company sites (`?gh_jid=`) isn't recognized; the model reads the careers page instead. | `ats.ts` | Open |
| M15 | Job links | Ashby downloads the whole board under a 3 MB cap; big companies probably exceed it and get "paste it". | `ats.ts:75` | Open (unverified) |
| M16 | Job links | The model's extracted description isn't checked against the page text. | `model-extract.ts:65` | Open |
| M17 | Parse | The validator checks contact, companies and schools against the file, not titles or bullets. | `parse-validate.ts:140` | Open |
| M18 | AI | Error copy: evidence and parse refusals said "try again" (paid retries of a sure no); unknown stop reasons got a paid repair. | `evidence.ts:150`, `parse-resume.ts:192`, adapter | Fixed `2be3711` |
| M19 | AI | A rescued refusal (Opus declines, Sonnet answers) was priced all at Sonnet. | adapter | Fixed `2be3711` (`usage.iterations`) |
| M20 | AI | FREE parse and job extraction run on Opus (task routes, not plan tasks), and the 75% downgrade doesn't touch them. | `src/lib/ai/routing.ts:32` | **Decide** (not changed: model routing is settled; flagging the cost only) |
| M21 | AI | Cover-letter answer budget (1,200 tokens, about 4,400 with thinking) may truncate. | `cover-letter.ts:299` | Open (needs a real key to check) |
| M22 | Limits | Daily ceilings still fail open and are check-then-act. With the in-flight limit, a burst now overshoots by about 2 calls, not 30. | `src/lib/daily-ceiling.ts` | Open (bounded) |
| M23 | Limits | Delete account and sign up again resets the free quota and the $0.50 cap; so does a second Google account. | `tailor-quota.ts` | Open (bounded by the global ceiling) |
| M24 | Exports | DOCX defines Heading 1 and Title twice (library default plus ours); which one Word uses isn't guaranteed. | `src/lib/resume-docx.ts:20` | Open (**Jake**: open one in Word and Google Docs) |
| M25 | Copy | "Job Hunt Pass · most popular" with zero customers (an FTC-style claim). | `src/app/page.tsx:195`, `offer-cards.tsx:79` | Fixed `591a847` ("best value") |
| M26 | Copy | Landing: "every number on the right is already on the left", but one isn't in the shown rows. | `src/app/page.tsx:154` | Fixed `591a847` |
| M27 | Copy | Legal "Last updated" was Sept 25; privacy changed Oct 2. | `legal-page.tsx:6` | Fixed `591a847` |
| M28 | Ops | CSP report-only had no `report-uri`, so violations were never seen. | `next.config.ts` | Fixed `591a847` (`/api/csp-report`, `[csp]` in logs) |
| M29 | Ops | Account deletion with a Storage failure left orphan files with only a log line. | `src/lib/account.ts:162` | Fixed `59379c6` (listed in `/admin` errors) |
| M30 | Copy | Model output used em-dashes, which recruiters read as AI writing. | prompts | Fixed `4a466ac` (prompt rule; no post-processing) |

### Low (selected; full lists are in the audit test files and commit messages)

| # | Finding | Status |
| --- | --- | --- |
| L1 | 100%-off promo pass granted nothing | Fixed `f2d6c50` |
| L2 | `customer.deleted` and other-mode (`livemode`) events not handled | Fixed `f2d6c50` |
| L3 | Stale Stripe read can be written after a newer one (needs the retrieve inside the lock) | Open |
| L4 | `incomplete` subscription (3DS pending) doesn't block a second checkout | Open |
| L5 | Refunding a pass after subscribing on top of it leaves free Pro until the old pass end | Open |
| L6 | No `email_verified` check at sign-in (admin is an email allowlist) | Fixed `6e9d8f3` |
| L7 | Cron secret compared with `!==` | Fixed `6e9d8f3` |
| L8 | `/admin` shell served to anyone (APIs were gated) | Fixed `6e9d8f3` |
| L9 | Tracker 10-job limit races and tailoring adds an 11th | Open (**Decide** whether tailored jobs count) |
| L10 | Password-protected PDF, PDF over 10 pages, empty file, expired session: generic messages | Fixed `2070cfc` |
| L11 | Default black Next 404, no error boundary | Fixed `5316998` |
| L12 | A successful tailor reported as failed if `lastOptimized` failed; failed cover-letter save returned no JSON | Fixed `2be3711` |
| L13 | Job lookup ran the model uncapped for a session with no user id | Fixed `242ed78` |
| L14 | Stream cut mid-event said "Can't reach rework" | Fixed `4cb7385` |
| L15 | Download names drop accented letters | Fixed `591a847` |
| L16 | Lowercase "rework" in tab titles and the offline message | Fixed `591a847` |
| L17 | Cover-letter date is the server's UTC "today" at download | Open |
| L18 | DOCX puts Skills before Education (PDF the other way); empty extra section prints a bare heading | Open |
| L19 | Feedback route has no rate limit and looks the user up by email | Open |
| L20 | `safe-fetch` allows any port and Teredo `2001::/32`; decodes every page as UTF-8 | Open |
| L21 | Net revenue ignores international card and Billing fees (Pro cap about $9.77, not $9.99) | Open (margin still positive) |

## What was proven sound

- Every API route returns 401 signed out with zero DB calls (34 cases). As user A, no route
  reads or writes user B's resume, application, letter, tracker card, evidence or nested
  ids (`applicationId`, `changeId`, `replaces`, `resumeId`). Admin APIs return 403.
- FREE limits hold server-side: 12 parallel tailors give exactly 3 model calls
  (`reserveMonthly` is atomic). Evidence and Word export are Pro-gated on the server.
- Webhook: raw-body signature check, event ids recorded, subscriptions re-fetched (out of
  order is safe), per-user advisory lock, grants only for configured price ids. A duplicate
  `checkout.session.completed` never grants 180 days. Pass is exactly 90 days, stacks,
  never renews, and access is computed at request time (cron failure can't extend it).
- Pass to Pro mid-pass: billing starts when the pass ends (`trial_end`), no double charge.
- SSRF: private IPs, decimal/octal/hex IPs, IPv4-mapped IPv6, DNS rebinding and every
  redirect hop are checked. LinkedIn (all hosts, `lnkd.in`, redirects into LinkedIn) is
  never fetched.
- Uploads are identified by magic bytes; Vercel's 413/504 HTML becomes a human message.
- Exports: text selectable, no images, standard headings, contact in the body, real bullets,
  DOCX has no tables, text boxes, images or header/footer content.
- Account deletion cancels Stripe first and aborts if it can't, deletes files, cascades.
- Landing, pricing and terms read every price and limit from `plans.ts` ($15, $29, 3/1/10).

## What Jake must do by hand

Before Nov 6 (in this order):

1. **Anthropic Console**: set a hard monthly spend limit on the workspace (the last
   backstop if everything else fails).
2. **Vercel env (Production)**: `AI_FREE_DAILY_USD` (default 25 if unset: the most free
   accounts can cost you in a day; paying users never hit it), confirm `CRON_SECRET`, `NEXTAUTH_URL=https://rework.hellojakejohn.com`,
   no `AI_*` var routes to openrouter. Know where `AI_DISABLED=1` goes (the incident switch:
   set it and redeploy).
3. **Vercel env (Preview)**: separate test DB and Stripe test keys, or Deployment
   Protection on (M10).
4. **Stripe live mode**: products and prices ($15/month, $29 one-time) and their ids in
   Production env; webhook endpoint `https://rework.hellojakejohn.com/api/stripe/webhook` on
   API version **2026-02-25.clover** with these 10 events: `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`,
   `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created`, `customer.deleted`.
   Portal: payment method, invoices, cancel at period end, only the $15 price. Checkout: one
   subscription per customer. Statement descriptor, receipts, failed-payment emails, Radar.
5. **Clear test billing data in the prod DB** before the first live sale, while every
   Stripe row is still from test mode (Supabase SQL editor; run the counts first and read
   them):
   ```sql
   select source, status, count(*) from entitlements group by 1, 2;
   select count(*) from users where "stripeCustomerId" is not null;
   -- then, only if every row above is a test purchase:
   update users set "stripeCustomerId" = null, "stripeSubscriptionId" = null,
     "stripePriceId" = null, "stripeCurrentPeriodEnd" = null;
   delete from entitlements where source in ('STRIPE_PASS', 'STRIPE_SUBSCRIPTION');
   delete from stripe_events;
   ```
   Keep any `COMP` rows you gave on purpose.
6. **Deploy, then open `/api/health` as admin**: `ok: true`, `checks.stripePrices` ok,
   `checks.stripeWebhook` ok, `checks.ai.anthropic.ok` true on Opus (H6).
7. **Monitoring**: create a free Sentry project (or accept `/admin` as the only error view),
   and point an uptime monitor (UptimeRobot / Better Stack, free) at `/api/health/live`.
8. **Supabase**: re-run the RLS check below on project `oxedndnmssyuffkfkcug` (the local MCP
   connectors are TripQuest's projects). Expect `rls = true` on every table and no grants for
   `anon` / `authenticated`:
   ```sql
   select c.relname, c.relrowsecurity as rls,
          has_table_privilege('anon', c.oid, 'select') as anon_select,
          has_table_privilege('authenticated', c.oid, 'select') as auth_select
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' order by 1;
   ```
   The new `ai_inflight` rows live in the existing `events` table: no migration.
9. **Manual export check**: open one Classic and one Modern download in Word and Google
   Docs (headings, bullets, right-aligned dates), and paste one PDF into a real apply form
   (Greenhouse or Lever autofill) to see it parse.
10. **Vercel**: Web Analytics on; failed-deployment email alert on.
11. **Merge order** (your call, when ready): #7 into main, then #8, then #9, then this PR.

## What $25 a day of free-tier AI buys

Estimates from the prices in `src/lib/ai/models.ts` (Opus 5.5 $4/$20, Sonnet 5.5 $2/$10 per
million input/output tokens) and guessed token counts; the real numbers show up in `/admin`
(AI spend by model) after the first day.

| Free-account action | Model | About |
| --- | --- | --- |
| Resume upload (parse) | Opus | $0.09 |
| Job link the model has to read (Greenhouse, Lever, Ashby, Workday, JSON-LD links cost $0) | Opus | $0.05 |
| Tailor | Sonnet | $0.07 |
| Cover letter | Sonnet | $0.04 |
| A typical new signup (upload, one job link, one tailor) | | $0.21 |
| A free user who uses everything in a month (upload, 2 links, 3 tailors, 1 letter) | | $0.44 (under their $0.50 cap) |

So `AI_FREE_DAILY_USD=25` is roughly **120 typical signups a day**, or about 55 who use
everything, or about 350 tailors, and at most **$750 a month** from free accounts. Paying
users are outside that number, and each one's AI is capped at 0.70 x what they paid, so they
can't cost more than they bring in. Roughly one $29 pass a day covers a maxed-out free tier.
When the ceiling hits, free accounts see "the free plan has used today's AI allowance... Go Pro
to keep going now" until midnight UTC.

## Go / no-go checklist for Nov 6

- [ ] All four PRs merged to `main` and deployed; prod `/api/health` returns `ok: true`
- [ ] Anthropic workspace spend limit set; `AI_FREE_DAILY_USD` decided (default $25)
- [ ] Stripe live: prices, webhook (clover, 10 events), portal, one-subscription setting
- [ ] Test billing data cleared from the prod DB
- [ ] One real $29 pass bought with a real card, Pro granted, then refunded and revoked
- [ ] One real $15 subscription, canceled in the portal, access kept to period end
- [ ] Sign in with a fresh Google account on prod; upload, tailor, download PDF and DOCX
- [ ] `/api/health/live` monitored; you know where `AI_DISABLED` is
- [ ] Preview env isolated (or protected)
- [ ] Phone check of `/`, `/pricing`, `/dashboard` on the deployed build
- [ ] Terms and Privacy reread; privacy lists Anthropic (it does), no OpenRouter in use

If any of the first five aren't done, it's a no-go for taking money on Nov 6; the free
product can still launch with Stripe off (checkout shows "not configured yet").

## Not verified here (needs keys, a dashboard, or a human)

- Real model latency and token use per call; whether Sonnet 5.5 is an accepted fallback for
  Opus 5.5 (H6 check covers it after deploy).
- Which API version the live Stripe endpoint is on (dashboard only).
- Word, Google Docs and real ATS rendering.
- Phone layout of the signed-in pages on the deployed build (the rebrand pass shot the flow
  at 375px; tracker and settings weren't shot).
- Vercel and Supabase settings (env, plan, Deployment Protection, RLS on the ReWork project).
