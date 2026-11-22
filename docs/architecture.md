# How ReWork is built (and what to strengthen)

Written Nov 21, 2026. What we use for each job, how it works, why we picked it, and the
foundation work worth doing before growth. Technical detail lives in `STATE.md`; this is
the map.

## The whole thing in one picture

```
Job seeker's browser
  |  rework.careers (Next.js pages, Tailwind)
  v
Vercel (Oregon, pdx1)
  |-- Pages + API routes (Next.js App Router, TypeScript)
  |-- Middleware: sign-in redirects, cross-site write block, signup source cookie
  |-- Crons: daily job pull, entitlement expiry, keepalive
  |
  |--> Supabase Postgres (Oregon, us-west-2) via Prisma: users, resumes, jobs, events
  |--> Supabase Storage: uploaded resume files
  |--> Anthropic API: Claude Opus 5.5 (paid users), Sonnet 5.5 (free tier)
  |--> Stripe: checkout, billing portal, webhook -> entitlements
  |--> Google: sign-in (NextAuth)
  |--> Employer job boards: Greenhouse, Lever, Ashby, SmartRecruiters, Workday
```

Everything sits in one region (Oregon) so pages talk to the database fast.

## Each piece: what, how, why

| Job | We use | How it works here | Why this one |
| --- | --- | --- | --- |
| **App framework** | Next.js 15 (App Router), TypeScript, React | Pages and the API in one codebase; `(app)/` routes need a session | One repo, one deploy, the most common stack (easy to hire for or sell) |
| **Hosting** | Vercel Pro ($20/mo) | Every merge to `main` deploys; previews need a Vercel login; 300s function limit for AI calls | Zero server work, built for Next.js, cron and analytics included |
| **Database** | Supabase Postgres + Prisma 6 | Prisma for queries; schema changes pasted by hand in the SQL editor; RLS on, no public grants | Real Postgres (no lock-in), cheap, Storage in the same place |
| **File storage** | Supabase Storage | Original resume uploads (`src/lib/storage.ts`) | Same account as the DB, private buckets |
| **Sign-in** | NextAuth v4, Google only | Database sessions (cookie holds an opaque token) | No passwords to store or leak; most job seekers have Google |
| **AI** | Anthropic (Opus 5.5, Sonnet 5.5) via our own layer `src/lib/ai/` | Every call is logged with its cost (`ai_call` events); per-user caps, daily ceilings, kill switch | Best writing quality; one provider keeps privacy simple; Anthropic doesn't train on API data |
| **The fact guard** | Our own code, no AI | After every rewrite, plain code checks employers, titles, dates, numbers, tools, credentials against the resume (`src/lib/fact-guard.ts`, `text-facts.ts`) | The product's core promise; deterministic so it can't be talked out of it |
| **Payments** | Stripe + Managed Payments | Checkout, portal, webhook writes an `Entitlement` row; Stripe handles sales tax | Industry standard, handles tax and receipts, refunds in one click |
| **Job feed** | Our pullers in `src/lib/feed/` | Daily cron pulls 150+ boards (33k jobs); Workday searched live per match; jobs close when they vanish | Free public APIs from employers' own boards: fresh, legal, no scraping LinkedIn |
| **Matching** | Our keyword scoring + a little AI | Job keywords extracted once per job, matched against the resume with "in other words" synonyms | Cheap per match, explainable ("here's what's missing") |
| **Exports** | @react-pdf/renderer, docx | 4 PDF templates, ATS-safe Word file | Real text, single column, embedded fonts |
| **Analytics** | Our `events` table + `/admin`, Vercel Web Analytics | Funnel, signups by source, errors, AI spend, sales | We own the data; no third-party trackers on job seekers |
| **Monitoring** | UptimeRobot, `/api/health`, `server_error` events | Uptime pings, an admin health check (DB, Stripe, AI, file readers) | Free, enough for now |
| **Email in** | ImprovMX (free) | support@ and any @rework.careers forward to Jake's Gmail | Free, two DNS records |
| **Browser extension** | `extension/` (Chrome, Manifest 3) | Saves a LinkedIn/Indeed job from the user's own browser; fills applications (never submits) | Reads sites we can't fetch, without breaking their rules |
| **Token (optional)** | Solana, burn for Pro | Off unless `REWORK_MINT` is set; own spend ceiling | Kept apart from the product (`docs/token-plan.md`) |

## Running costs (monthly, today)

| What | Cost |
| --- | --- |
| Vercel Pro | $20 |
| Supabase | Check the plan (free tier, or $25 for Pro with daily backups) |
| Anthropic | Usage only: about 3 to 10 cents per tailored job; hard limit $500/mo |
| Domain | $66/yr (about $5.50/mo) |
| Stripe | Per sale: card fee plus 3.5% Managed Payments |
| ImprovMX, UptimeRobot, Vercel Analytics | Free |

So fixed costs are roughly $25 to $50 a month: two passes cover it.

## Foundation: what's solid

- **Money is safe:** prices checked against Stripe by `/api/health`, uses reserved before
  each AI call, per-user AI caps, global daily ceilings, kill switch, Anthropic hard limit.
- **Security basics:** auth on every API route, ownership checks before any by-id change,
  cross-site write block, upload type checked by file bytes, security headers, RLS on.
- **Tests:** 950+ offline tests (Vitest), typecheck and lint clean.
- **Docs:** `PROJECT.md`, `STATE.md`, this file, the gameplan. A new developer (or a
  buyer) can find their way.

## Foundation: what to strengthen (ranked)

| # | Gap | Why it matters | Fix | Effort | Needs Jake? |
| --- | --- | --- | --- | --- | --- |
| 1 | **Local dev and scripts use the production database** | One wrong script or test signup touches real users' data | A second Supabase project (free) for local and preview; point the local env at it | 1 to 2 h | Yes: create the project, paste the URL locally |
| 2 | **No automatic checks on PRs** | A broken change can merge if a step is skipped | GitHub Actions: typecheck, lint, tests on every PR (free for this repo size) | 1 h | Just merge it |
| 3 | **No automatic backups (Supabase free tier)** | Losing the database would lose every user's resumes | Weekly `npm run backup` (Nov 22) until revenue covers Supabase Pro ($25/mo, daily backups) | Done, then $25/mo | Runs it Sundays |
| 4 | **No email out** | Can't send welcome, follow-up reminders, job alerts or receipts of our own | Resend (free tier: 3k emails/mo), domain records in Vercel | 2 to 3 h | Yes: new account, DNS |
| 5 | **Errors only show when someone opens `/admin`** | A broken checkout could go unnoticed for a day | A daily summary email (needs #4), or Sentry free tier | 1 to 2 h | Yes: account |
| 6 | **Old OpenAI/OpenRouter code still in the repo** | Dead code, and the `openai` package carries known security warnings | Remove the adapters and the package | 1 h | No |
| 7 | **Rate limits are per server instance** | Fine at this size; a determined abuser could burst | A database-backed limit, only if abuse shows up | 2 h | No |
| 8 | **Content-security rules are report-only** | The safety net isn't enforced yet | Read a week of `[csp]` reports in Vercel logs, then enforce | 1 h | Yes: share the logs |
| 9 | **Schema changes are pasted by hand** | Easy to forget a step (RLS, REVOKE) | A checklist in `STATE.md` (exists); keep each migration file self-contained | Ongoing | Pastes them |
| 10 | **Closed jobs pile up in the database** | The jobs table grows forever | Delete jobs closed more than 60 days ago in the daily cron | 1 h | No |
| 11 | **Framework upgrades waiting** | Next 16 and Prisma 7 exist | Plan them for a quiet week, one at a time, with tests | Half day each | Prisma needs OK |

**Recommended order:** 2 (CI), 1 (dev database), 3 (backups) this coming week, since
they protect everything else. Then 4 and 5 (email and alerts) in December alongside the
marketing work. 6 and 10 whenever there's a gap.
