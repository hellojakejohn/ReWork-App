# Jake's todo bin

Things only Jake can do (dashboards, money, secrets). Top to bottom is the order.
Tick them off here or just tell Claude "done with N".

## Launch (the last gate)

1. [ ] **The $29 test.** On rework.careers, signed in as Stevie: Upgrade, Get 3 months for
   $29, pay with your card. Check the header shows Pro. Then Stripe, Payments, open it,
   Refund (full). Tell Claude "refunded"; Claude checks Pro switched on, then off.
   (Nov 17: checkout reaches Stripe's payment page again after the tax-code fix.)
2. [ ] Optional: one $15 subscription, then cancel it in the billing portal.
3. [ ] Merge the open PRs Claude lists in `docs/questions-2026-11-18.md`.

## After launch

4. [ ] **Support email**: free forwarding `support@rework.careers` to your Gmail (ImprovMX or
   similar, two DNS records in Vercel Domains), then Claude switches the site and Stripe to it.
5. [ ] **USAJOBS key** (federal jobs). Free key at developer.usajobs.gov. Vercel Production
   env: `USAJOBS_API_KEY` and `USAJOBS_EMAIL` (the same email), redeploy. Tell Claude.
6. [ ] **Adzuna**: decide on a licence (developer.adzuna.com). Claude builds it after a deal.
7. [ ] **Chrome Web Store** (post-launch feature): $5 developer account, Claude builds the zip
   and writes the listing. When approved, Claude adds the install link and turns the copy on.
8. [ ] Vercel failed-deployment email alert (Settings, Notifications).

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
