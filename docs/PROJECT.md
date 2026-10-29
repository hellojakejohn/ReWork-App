# ReWork: the whole project on one page

Last updated 2026-10-28. Read this first, then `STATE.md` (current technical truth). Deeper
docs: `docs/launch-audit.md` (launch go/no-go, Jake's by-hand list), `docs/AUDIT.md`
(Oct 23 audit, competitor table, full roadmap), `docs/token-plan.md` ($REWORK).

## What it is

ReWork (rework.hellojakejohn.com) is a resume tailor that won't lie for you. Upload a
resume once, paste a job link, get a tailored resume and cover letter in about a minute.
Every rewrite is checked against the original by deterministic code after the model:
no invented employers, tools, numbers or credentials. Built and run solo by Jakob (Jake)
Johnson, Saint Paul, MN, as an individual.

Who it's for: active job seekers sending many applications, career changers (restaurant
manager to ops coordinator), and technical people (Jake's own Web3 and full-stack niche).

Why it wins (keep leaning on these):
- **The fact guard is real.** No competitor (Teal, Huntr, Jobscan, Rezi) enforces it.
- **The evidence interview** asks for real numbers instead of guessing them.
- **The skill check (free)** scores fit before a tailor is spent and asks about each missing
  keyword (No / A little / Yes + where or how); only the user's answers become resume text.
- **Honest misses.** We show the keywords we couldn't add because you don't have them.
- **Pay once for a job hunt** ($29 for 90 days) fits how people actually search.

## Product scope

In (built, on `main`): Google sign-in; PDF/DOCX/paste parse into a master resume; job
URL resolver (ATS APIs, JSON-LD, page + model, paste fallback; LinkedIn never fetched);
tailor with fact guard, keyword coverage and per-bullet accept/revert; cover letters with a
prose fact guard; free fit check + skill check on the Tailor card; evidence interview (Pro); application tracker (kanban); Classic/Modern PDF
and Word export; Stripe pass + subscription; admin analytics; Download my data / Delete my
account; Burn $REWORK for Pro (off until `REWORK_MINT` is set).

Out for launch: job feed, post-a-job, crypto payments in checkout, interview prep, resume
builder from scratch, contacts CRM.

## Monetization

| Plan | Price | Net after Stripe | What you get |
| --- | --- | --- | --- |
| Free | $0 | | 3 tailors and 1 cover letter a month, tracker up to 10 jobs, PDF |
| Job Hunt Pass (headline) | $29 once, 90 days, never renews, stacks | $27.86 | Pro for a whole search |
| Pro Monthly | $15/month | $14.27 | Pro: tailors and letters for an active search, evidence interview, Word export, full tracker |
| Burn for Pro | burn $15 of $REWORK | | 30 days of Pro (after the token launches) |

Never say "unlimited": copy says "Fair use: plenty for an active job search". All numbers
live in `src/lib/plans.ts`.

Unit economics (real eval, 2026-10-28): one full job (tailor + cover letter) costs about
$0.096 on Opus 5.5 and $0.034 on Sonnet 5.5; a resume parse about $0.06 on Opus.
Money guards, layered:
- **Per-user AI cap** = 0.70 x net revenue for the period (Pro about $10/month, pass about
  $19.50 for 90 days, free $0.50/month). At 75% paid users drop to Sonnet with a banner; at
  100% AI pauses until reset. A Pass therefore covers roughly 200 Opus jobs; Pro about 100 a
  month. Users only ever see a percent.
- **Daily ceilings** per user (20 tailors, 20 letters, 10 parses, 10 evidence, 30 skill-check calls a day).
- **Global daily ceilings**: `AI_FREE_DAILY_USD` for all free accounts,
  `AI_BURN_DAILY_USD` for burn-Pro accounts. Both set to $2 in Vercel on 2026-10-28 for a
  cautious start (from Jake's CLI run; confirm in the Vercel dashboard). Code defaults are
  $25 and $12. Raise once real traffic shows in `/admin`.
- **Kill switch** `AI_DISABLED=1` and **prepaid Anthropic credits** (auto-reload off) as
  the hard stop.

The $REWORK token (Solana, Bags launchpad, zero dev allocation, Jake earns creator fees
only) is a side channel, never in the product flow. The one token feature is burn for Pro.
No holder perks, discounts or buybacks. Rules and launch-day plan: `docs/token-plan.md`.

## Where it stands (2026-10-28)

- PRs #7 to #13 merged and deployed. Prod health is green except Stripe.
- AI: Anthropic only. Opus 5.5 everywhere, Sonnet 5.5 for the free tier and as a one-time
  retry when Opus declines (Anthropic accepts no server-side fallback for either model).
- Quality: real-resume eval run twice; four fixes shipped in #13 (extra sections reach the
  tailor, a saner cover-letter guard, all-caps names, smarter keyword matching).
- Launch blocker: Stripe live setup (prod key is an invalid test key).

## Roadmap

**Before launch (Fri Nov 6, 2026)**
1. Stripe live setup, clear test billing data, one real pass + one subscription, refund
   (`STATE.md` "Next session", `docs/launch-audit.md` items 4 to 6).
2. Sentry (or accept `/admin`) and an uptime monitor on `/api/health/live`.
3. Isolate the Preview env (own DB and Stripe test keys, or Deployment Protection).
4. More quality tuning with real resumes (`STATE.md` "Quality eval" ideas), fresh-account
   smoke test on prod, phone check, Word/Google Docs/ATS export check.
5. Go/no-go list at the bottom of `docs/launch-audit.md`.

**Launch day**: product live and a real Stripe sale verified first; token at midday CT
(`docs/token-plan.md` section 5).

**Week 1**: watch `/admin` daily (funnel, `ai_error`, `limit_hit`, spend by model); raise
the $2 daily ceilings if free users hit them; feedback email to Jake; fix what users hit.

**Month 1**: before/after match score with "keywords we couldn't add honestly" on the Result
card; real tailor output on the landing; follow-up reminder emails (needs an email
provider); admin feedback view; one more template; durable rate limit if abuse shows.

**January push** (job-search peak): marketing push, token January plan
(`docs/token-plan.md` section 6).

**Later**: browser extension to save the open job page (LinkedIn read client-side, the
biggest gap vs competitors); full OpenAI/OpenRouter code removal; Prisma 7 (needs Jake's
OK); LinkedIn profile suggestions; email magic link.

## Settled decisions (don't reopen)

Pricing ($29 pass, $15 monthly); models (Opus 5.5 default, Sonnet 5.5 free tier, no
Haiku); Anthropic-only refusal handling (never retry on OpenAI/OpenRouter); LinkedIn URLs
never fetched server-side; no fallback resume parser; token: zero dev allocation, burn for
Pro is the only feature, no lawyer before launch with the phrasing rules applied.

## How we work

- Jake is solo, often on his phone (Remote Control): short replies, phone-sized.
- No em-dashes anywhere (code, comments, copy, docs). Concise.
- Work on a new branch, small commits, PR at the end; never push to main. Jake merges PRs
  himself (regular merge commit, not squash, so stacked PRs stay clean).
- Ask before any spend, prod env change, merge, or DB migration. Migrations are pasted by
  hand in the Supabase SQL editor; never `prisma migrate deploy`; don't upgrade Prisma.
- Secrets never go through chat: Jake pastes them into Vercel or the local env file.
- Always test (`npx tsc --noEmit`, `npx vitest run`, lint) before committing.
