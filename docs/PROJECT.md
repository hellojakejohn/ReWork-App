# ReWork: the whole project on one page

Last updated 2026-10-29. Read this first, then `STATE.md` (current technical truth). Deeper
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
Save to ReWork button (bookmarklet + Chrome extension) that reads LinkedIn/Indeed/any job
page client-side;
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

## Where it stands (2026-10-29)

- PRs #7 to #29 merged. Prod health is green except Stripe.
- New on Oct 29: free skill check and fit check (#22, #23), tailor keeps the proof in
  bullets (#24), Save to ReWork for LinkedIn and Indeed (bookmarklet + Chrome extension,
  #25, #26), Job match before -> after on the receipt (#27), test run and demo files (#28),
  job-scam warnings on the Job card (#29).
- AI: Anthropic only. Opus 5.5 everywhere, Sonnet 5.5 for the free tier and as a one-time
  retry when Opus declines.
- Launch blocker: Stripe live setup (prod key is an invalid test key).

## What job hunters hate, and our answer (research 2026-10-29)

Survey sources: Resume Genius, iHire, Greenhouse, TopResume (see `docs/handoff-2026-10-29.md`).
- No reply after applying (55-58% name it first): tracker today; follow-up nudges next.
- Fake, ghost and scam jobs (39% call it their main problem; no resume tool checks): scam
  warnings shipped (#29); ghost-job signals (age, reposts, no pay, agency) next.
- AI text that sounds like AI (80% of hiring managers say they can tell): banned phrases,
  proof kept in bullets, per-bullet accept/revert.
- Competitor AI inventing things (reviews: Rezi invents numbers, Careerflow edits without
  asking, Teal pastes job requirements in): the fact guard. A trust line, not the headline;
  our own evals catch an invention in only ~1 of 28 tailors.
- Monthly billing and free tiers that run out (Enhancv free ends after 7 days): pay once.
- Headline to test: speed plus the honest match ("Tailored in a minute, 40% -> 72%").

## Roadmap

**Before launch (Fri Nov 6, 2026)**
1. Stripe live setup, clear test billing data, one real pass + one subscription, refund
   (`STATE.md` "Next session", `docs/launch-audit.md` items 4 to 6).
2. Jake's test run (`docs/test-run.md`, 20 steps; step 17, signed-in LinkedIn, is the big
   untested one). Record it with the demo files in `docs/demo/` for launch posts.
3. Chrome Web Store: Jake pays the $5 developer fee and uploads `extension-dist.zip`
   (`extension/README.md`); review usually takes a few days.
4. Sentry (or accept `/admin`) and an uptime monitor on `/api/health/live`.
5. Isolate the Preview env (own DB and Stripe test keys, or Deployment Protection).
6. More quality tuning with real resumes (`STATE.md` "Quality eval" ideas), fresh-account
   smoke test on prod, phone check, Word/Google Docs/ATS export check.
7. Go/no-go list at the bottom of `docs/launch-audit.md`.

**Launch day**: product live and a real Stripe sale verified first; token at midday CT
(`docs/token-plan.md` section 5).

**Week 1**: watch `/admin` daily (funnel, `ai_error`, `limit_hit`, spend by model); raise
the $2 daily ceilings if free users hit them; feedback email to Jake; fix what users hit.

**Nice before launch, else week 1**: ghost-job signals on the Job card (posting age,
reposted, no pay, recruiting agency, applicant count; facts, never a verdict; read in the
browser by Save to ReWork); tracker follow-up nudges ("7 days, no reply: here's a short
follow-up"); landing headline on speed plus the match.

**Month 1**: real tailor output on the landing; follow-up reminder emails (needs an email
provider); admin feedback view; one more template; durable rate limit if abuse shows.

**January push** (job-search peak): marketing push, token January plan
(`docs/token-plan.md` section 6).

**Later**: full OpenAI/OpenRouter code removal; Prisma 7 (needs Jake's
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
