# Jake's todo bin

Things only Jake can do (dashboards, money, secrets). Top to bottom is the order.
Tick them off here or just tell Claude "done with N".

## Now (found in the Nov 27 check, most urgent first)

A. [x] (Verified Nov 27.) **Verify the domain contact by Sun Nov 30.** Vercel Domain Services emailed Nov 15
   ("[ACTION REQUIRED] Verify Your Domain Contact Information"): ICANN needs the email
   verified within 15 days or rework.careers is temporarily disabled (site, sign-in,
   support email, all of it). Click the button in that email, or Vercel > Domains >
   rework.careers. The domain is fine today (not on hold, paid to Nov 15, 2027). Tell Claude
   "verified".
B. [ ] **Stripe payouts are paused.** Stripe emailed Nov 20: ReWork has a negative balance
   of $1.02 (fees from the $29 test refund) that it couldn't take from the bank account.
   Stripe > Settings > Payouts: fix or re-add the bank account (or add funds). Payouts
   resume after. Customers can still pay; only payouts to you are stuck.
C. [ ] **Merge the open PRs:** 123 (email card on /check and /fit; its SQL is already
   pasted), 122 (reply kit, docs only), and the Nov 27 health-check PR (Anduril board fix).
D. [ ] Optional, 1 minute: Vercel > Domains > www.rework.careers redirect: switch 307 to
   308 (permanent). Google flagged "Page with redirect" Nov 26; that's www and http
   variants redirecting, which is normal, and every sitemap page answers 200.
E. Ignore: ImprovMX "Setup rework.solutions" and the expired confirm link. That's the old
   domain; rework.careers forwarding (MX and SPF) is live.

## Launch (the last gate)

1. [x] **The $29 test.** (passed and refunded Nov 19) On rework.careers, signed in as Stevie: Upgrade, Get 3 months for
   $29, pay with your card. Check the header shows Pro. Then Stripe, Payments, open it,
   Refund (full). Tell Claude "refunded"; Claude checks Pro switched on, then off.
   (Nov 18: prices are tax-included, so checkout should total exactly $29.)
2. [-] **The $15 test** (skipped Nov 19; check the first real subscriber instead) (you said yes): right after the $29 one, Subscribe for $15/month,
   pay, then Manage billing, Cancel. Refund it in Stripe too. Tell Claude "cancelled".
3. [x] Launch (you said yes: the moment both tests pass).

## After launch

4. [x] **Support email** (ImprovMX on rework.careers, Nov 19; Stripe Public details set Nov 22): free forwarding `support@rework.careers` to your Gmail (ImprovMX or
   similar, two DNS records in Vercel Domains), then Claude switches the site and Stripe to it.
5. [x] **Paste `docs/sql/paste-2026-11-23.sql`** in Supabase (done Nov 23; tables checked, RLS on).
5b. [x] **USAJOBS key** (done Nov 23: both env vars in Vercel Production, redeployed). Free key at developer.usajobs.gov. Vercel Production
   env: `USAJOBS_API_KEY` and `USAJOBS_EMAIL` (the same email), redeploy. Tell Claude.
6. [ ] **Adzuna** (Nov 22: signed up; licence email sent to info@adzuna.com; label built in PR 99. Their terms: paid apps need a licence after a 14-day trial, and each listing needs an "Adzuna" label linked to adzuna.com, not built yet) (built Nov 22, off until keys are set): sign up at developer.adzuna.com, then
   email them that ReWork is a paid app that shows their ads as job matches and ask if the
   free tier covers it (an earlier read said commercial use needs a licence). Once they say
   yes: Vercel Production env `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`, redeploy. Tell Claude.
7. [ ] **Chrome Web Store** (post-launch feature): $5 developer account, Claude builds the zip
   and writes the listing. When approved, Claude adds the install link and turns the copy on.
8. [ ] Vercel failed-deployment email alert (Settings, Notifications).
9. [x] Google Search Console (Nov 22): domain verified, sitemap submitted.
10. [x] (checked by Claude Nov 27) `feed_pull` shows about 8,300 USAJOBS jobs a day. The
   Nov 23 weekly dry run skipped everyone with "no new jobs": a dry run only reads saved
   matches (no refresh, no spend), so it can't preview a real Monday. Next real test is
   step 3 of the weekly email below (`EMAIL_WEEKLY=admins`).
11. [ ] Tue Nov 24: launch posts on X and LinkedIn (`docs/launch-posts.md`), links with `?ref=x` / `?ref=linkedin`.
12. [ ] This week: first 5 partner emails (`docs/marketing/partners.md`, CareerForce Saint Paul first).
13. [ ] Any time: daily numbers email. In Vercel (Production) add `EMAIL_ADMIN_DIGEST=dry`, redeploy,
    check /admin events for `admin_digest` the next morning, then set it to `on`. It lands at 8:45am CT.

## Every Sunday (2 minutes, until Supabase Pro)

- Run `npm run backup` in the project folder. It saves the database to `~/ReWork-backups`
  (outside the repo; it holds users' resumes). Supabase free has no backups of its own.
  Switch to Supabase Pro ($25/mo, daily backups) once revenue covers it.

## Resend (weekly email)

- [x] (Done Nov 23: domain added via the Vercel integration, DNS checked live, `RESEND_API_KEY` in Vercel.) Add domain `send.rework.careers` in Resend, paste its DNS records in Vercel Domains,
  create an API key, add `RESEND_API_KEY` in Vercel (Production). Pick a mailing address for
  the footer (PO box or virtual mailbox). Then Claude builds `docs/weekly-email-plan.md`.
- [x] (Nov 22: set, redeployed) Pick the mailing address for the email footer (PO box or virtual mailbox), then add it in
  Vercel Production as `EMAIL_MAILING_ADDRESS` (one line, e.g. `PO Box 123, Saint Paul, MN 55101`).
  Nothing sends without it.
- [ ] After the weekly email PR is merged, turn it on in steps (Vercel Production env, redeploy each time):
  1. [x] (Nov 22) `EMAIL_WEEKLY=dry`: Monday's cron logs who would get what in `/admin` (no sends, no AI spend).
  2. `/admin` > Emails > "Send me a test weekly" to see it in your inbox.
  3. `EMAIL_WEEKLY=admins`: next Monday only you get it, for real.
  4. `EMAIL_WEEKLY=live` and `EMAIL_WELCOME=1`: everyone.

## Close the gap (course links, optional money)

1. [x] Paste `docs/sql/paste-2026-11-24-skill-gaps.sql` (done: 369 plans cached, checked Nov 27).
2. Optional, affiliate links: join Coursera's program (on Impact) and Udemy's (on Impact or
   Rakuten). Each gives a deep-link format. In Vercel, add `AFFILIATE_COURSERA` and/or
   `AFFILIATE_UDEMY` as that link with `{url}` where the target goes, e.g.
   `https://your-network-link/...?u={url}`. Must start with https. Unset = plain search
   links, no commission. A disclosure line shows automatically when a tagged link is shown.

## Read when you have 10 minutes

- `docs/audit-2026-11-14.md`: the full audit (what was fixed, what's still open).

## Done

- 2026-11-13: PRs 44, 45, 46 merged and live.
- 2026-11-14: PR 47 (job matches) live; job feed SQL applied; first job pull; Stripe live
  checked; no test billing data; `/api/health` green.
- 2026-11-15: PRs 49 to 53 live (fast search, save to tracker, upgrade popup, extension
  hidden, launch copy, rework.careers, servers in Oregon). Anthropic $500/month limit and
  alerts, `AI_FREE_DAILY_USD=10`, Vercel Pro, domain bought ($29.99, then $66/yr), Google
  sign-in and Stripe webhook moved, old domain 308s, UptimeRobot, Web Analytics, Stripe
  public details, Deployment Protection checked.
- 2026-11-17: Stripe Managed Payments kept on (Stripe handles sales tax, 3.5% per sale);
  both products tagged "SaaS - personal use" (txcd_10103000), status Ready to use.
- 2026-11-18: PRs 54 and 55 merged. Stripe Tax setting "Include tax in prices" = Yes; both
  prices show "Use default (yes)" (Minnesota preview: $29.00 total, tax inside).
