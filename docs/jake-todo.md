# Jake's todo bin

Things only Jake can do (dashboards, money, secrets). Top to bottom is the order.
Tick them off here or just tell Claude "done with N".

## Now (unblocks PR 47, job matches)

1. [x] **Paste the job feed SQL in Supabase.** (done Nov 14) Copy it with
   `pbcopy < prisma/migrations/20261109000000_job_feed/migration.sql`, paste it into the
   Supabase SQL editor (ReWork project), run it. It only adds 3 new tables: safe any time.
   Then tell Claude, who merges PR 47 and checks prod.
2. [x] **Fill the job list once** (done Nov 14: 23,880 jobs, 137 boards) (after 47 is live): Vercel, ReWork project, Settings,
   Cron Jobs, `/api/cron/pull-jobs`, Run. Takes a few minutes. Otherwise matches stay
   empty until the daily pull at 6:30 am CT.

## More jobs (anytime, free)

2a. [ ] **USAJOBS key** (federal jobs: VA hospitals, logistics, admin, accounting). Request
   a free key at developer.usajobs.gov with the email you want on file. Then in Vercel
   Production env add `USAJOBS_API_KEY` (the key) and `USAJOBS_EMAIL` (that same email), and
   redeploy. Off until both are set. Tell Claude, who checks it with the test people.
2b. [ ] **Decide on Adzuna** (millions of jobs of every kind, all states). Its free key is a
   14-day trial; a product that makes money needs a licence from Adzuna (ask them for a quote
   at developer.adzuna.com). Claude can build it once there's a deal.

## Before taking money (about 20 min, best with Claude)

3. [x] **Stripe live mode** (checked Nov 14 in the dashboard: live products $29 and $15/mo,
   live webhook active with 10 events, portal set up. Still confirm Vercel uses the live
   keys via step 5.) Optional: add Terms and Privacy links in the portal settings.: the $15/month and $29 one-time prices, their ids in Vercel
   Production env, the webhook (API version 2026-02-25.clover, 10 events), the customer
   portal, one subscription per customer. Full list: `docs/launch-audit.md` item 4.
4. [x] **Clear test billing data** (nothing to clear on Nov 14: no Stripe customers, only 1 COMP) in the prod DB (SQL in `docs/launch-audit.md` item 5;
   run the counts first).
5. [ ] **Open `/api/health` signed in as admin**: it should say `ok: true`.
6. [ ] **Anthropic Console**: a hard monthly spend limit on the workspace, if not set yet.

## Your end-to-end test

7. [ ] Run `docs/test-run.md` on prod with a fresh Google account. Send Claude anything off.
8. [ ] One real $29 pass and one real $15 subscription, then refund the pass and cancel the
   subscription in the portal.

## Quick clicks (any time)

9. [ ] **Uptime monitor** (UptimeRobot or Better Stack, free) on
   `https://rework.hellojakejohn.com/api/health/live`.
10. [ ] **Vercel Deployment Protection** on for Previews (they share the prod DB).
11. [ ] **Chrome Web Store**: upload extension 0.2.0 (review takes days; launch doesn't
    wait on it). Build it from the merged main (PR 47 changed it on Nov 14) with
    `npx tsx scripts/build-extension.ts`, then upload `extension-dist.zip`.
12. [ ] Vercel Web Analytics on, failed-deployment email alert on.

## Read when you have 10 minutes

- `docs/audit-2026-11-14.md`: the full audit (what was fixed, what's still open).

## Done

- 2026-11-13: PRs 44, 45, 46 merged and live.
- 2026-11-14: PR 47 (job matches) merged and live.
