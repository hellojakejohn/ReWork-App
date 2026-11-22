# ReWork gameplan (from v1 to a real business)

Written Nov 21, 2026, the pause before real users arrive. This is the plan for the next
6 months: how the business runs, what we measure, how we market, what we build, how we
make more money, and how we stay safe. `docs/PROJECT.md` stays the one-page summary;
this is the "what next".

## Where we are (real numbers, Nov 21)

- **ReWork v1 is live** at rework.careers: upload, job matches, tailor with the fact guard,
  cover letters, answers, interview prep, tracker with follow-up nudges, 4 templates, Word
  export, Stripe ($29 pass, $15 monthly), `/admin`.
- **33,000 open jobs**, from 5 sources (Greenhouse 18.6k, SmartRecruiters 6.1k, Ashby 3.5k,
  Lever 3.0k, Workday 1.8k), refreshed daily.
- **3 users** (all ours), $0.78 of AI spend in 30 days, one real $29 sale (test, refunded).
- **Costs:** a full job (tailor plus letter) costs about 3 to 10 cents of AI. A pass buys
  about $19.50 of AI over 90 days, so every sale has room to spare.
- **Gaps that matter for marketing:** we don't record where a signup came from (X,
  LinkedIn, Reddit), we can't email users, and there's no referral loop.

## The one rule

**Every decision has to make ReWork more trustworthy for job seekers.** The fact guard,
honest misses and "we never apply for you" are the brand. Anything that trades trust for
quick money (selling data, fake urgency, ads to desperate people, "guaranteed interviews")
is off the table, because trust is the only thing a bigger company would pay for.

## 1. How the business runs

### Weekly rhythm (about 1 hour of Jake's time a week, plus marketing)

| When | What | Who |
| --- | --- | --- |
| Daily, 10 min | Reply to people on X/LinkedIn; check the support inbox | Jake |
| Daily, automatic | Job pull, uptime check, AI spend ceilings | The app |
| Monday, 20 min | Weekly review: `/admin` funnel, sales, errors, spend; pick the week's one build | Jake + Claude |
| During the week | Build in small PRs, Jake merges | Claude |
| Friday, 10 min | Post one thing we shipped or learned ("build in public") | Jake |
| 1st of the month | Money check: Stripe revenue, costs, 30% set aside for tax | Jake |

### Where everything lives

- **Product truth:** `docs/PROJECT.md` (summary), `STATE.md` (technical), this file (plan).
- **Jake's hand steps:** `docs/jake-todo.md`. **Launch copy:** `docs/launch-posts.md`.
- **Money:** Stripe dashboard (sales, refunds, tax is handled by Managed Payments).
- **Health:** `/admin` (funnel, errors, AI spend, job feed), UptimeRobot, Vercel.
- **Support:** support@rework.careers (forwards to Jake's Gmail).

### Business admin (do these before revenue gets real, roughly before $1k)

1. **Separate bank account** for ReWork money, even as a sole proprietor. Clean books
   are worth a lot if we ever sell. Point Stripe payouts there.
2. **Decide on an LLC** (Minnesota, about $155 to file). It separates personal and
   business risk. Talk to an accountant once; it's Jake's call, not a code change.
3. **Bookkeeping:** a spreadsheet is enough at first: date, what, amount, category.
   Keep every receipt (Vercel, Anthropic, domain, Supabase).
4. **Tax:** set aside 30% of profit. Stripe handles sales tax; income tax is ours.

## 2. What we measure

One number to steer by: **paid customers per week.** Everything else explains it.

| Stage | Metric | Where | First target (December) |
| --- | --- | --- | --- |
| Reach | Visitors | Vercel Analytics | 2,000 / month |
| Signup | Visitors who sign up | Vercel + `/admin` | 10% |
| Activation | Signups who see matches AND tailor once | `/admin` funnel | 60% |
| Value | Tailors per active user per week | `/admin` | 3+ |
| Limit | Free users who hit the 3-tailor limit | `/admin` ("Hit a limit") | 25% |
| Pay | Signups who pay within 30 days | `/admin` + Stripe | 3 to 5% |
| Love | Replies like "this got me an interview" | Support inbox, X | Collect every one |
| Cost | AI spend per paying user | `/admin` | Under $5 |

**Build first (before the launch posts):** record where each signup came from (the
`?ref=x` or `utm_source` on the link, plus the referring site) on the `signed_up` event,
and show signups by source in `/admin`. Without it we can't tell if X or LinkedIn works.

## 3. Marketing (first, because the product is ready and nobody knows it exists)

### Who we're for, in order

1. **People job hunting right now, outside big tech:** ops, health care, retail
   management, customer support, logistics, admin. Our job feed already covers them, and
   most AI resume tools are built for software engineers.
2. **Career changers** (restaurant manager to ops coordinator). "In other words"
   matching is made for them.
3. **Laid-off tech workers.** Loud online, willing to pay, but crowded with competitors.

### The message

- Headline: **"Find jobs that fit. Get a resume tailored to match, honestly."**
- Proof: the receipt ("here's what we changed, here's what we left out, invented: 0").
- Hook for posts: "AI is taking jobs. ReWork helps you take one back."

### Channels, ranked by effort vs payoff for a solo founder

| # | Channel | Why | Cadence |
| --- | --- | --- | --- |
| 1 | **LinkedIn (Jake's personal account)** | Job seekers live there; founder posts get reach | 3 posts a week |
| 2 | **X (Jake personal, quoted by @reworkcareers)** | Build in public, replies to job-search posts | 1 post a day, 10 helpful replies |
| 3 | **Reddit** (rules first) | Where job seekers vent; huge if a post lands | 1 good post a week, answer questions daily without linking unless asked |
| 4 | **SEO pages** | Compounds forever, no posting needed | Built once, then grows |
| 5 | **TikTok / Shorts** | Before/after screen recordings work for this | January push |
| 6 | **Product Hunt, Hacker News, Indie Hackers** | One-day spikes plus backlinks | Once each, spaced out |
| 7 | **Partners** (career coaches, bootcamps, libraries, workforce centers) | One deal = many users | Start in December |

Paid ads: **not until** we know our signup-to-paid rate (about 10 paying customers in).
Then a small test ($50 to $100 on Reddit or Google search for "tailor resume to job") and
keep it only if a customer costs less than about $15 to win.

### Content pillars (so posting never feels blank)

1. **Before/after:** one bullet, the job ad, the honest rewrite, what we refused to add.
2. **Job-search truths:** ghost jobs, scam signs, follow-ups, what ATS really does.
3. **Build in public:** what shipped, what broke, real numbers (signups, never revenue
   bragging), "a user asked for X so we built it".
4. **Weekly job drop:** 10 good remote or non-tech jobs from our feed, each with
   "tailor for this".

### Growth loops to build (product that markets itself)

- **Referral in Pro days:** invite a friend who tailors, you both get 7 days of Pro.
- **Free fit check without sign-up:** paste a job, upload a resume, see your match % and
  missing keywords. Sign up to tailor. A lead magnet people share.
- **Public SEO pages:** "Resume tips for an [ops coordinator] job" built from real job
  keyword data across our 33k jobs. Thousands of long-tail pages, honest content, each
  ending in "check your fit for free".
- **Shareable receipt:** an image of "what changed, what we left out" users can post.

### This week (low energy, still useful)

- Keep following and liking job-search accounts (you're already doing it).
- Saturday or Sunday: record the 45-second demo (`docs/launch-posts.md` has the steps).
- Monday Nov 23: launch thread on X and LinkedIn. Then answer every reply.
- Claude builds signup-source tracking before Monday so we can see what works.

## 4. Product roadmap (value first, ranked)

### Now to mid-December: learn from real users

1. **Signup source tracking** in `/admin` (above). Small, needed before posting.
2. **Fix whatever the first 20 users hit.** Read every feedback form and error.
3. **Email:** a provider (Resend, free tier) for a welcome email and a weekly digest
   ("3 new matches, 1 follow-up due"). Emails bring people back; we can't today.
4. **Referral in Pro days.**
5. **Chrome Web Store listing** for Save to ReWork ($5 fee, Jake). Store listings are a
   free discovery channel.

### January push (the biggest job-search month)

6. **Free fit check without sign-up** (lead magnet).
7. **SEO pages** from our job keyword data.
8. **More jobs:** the 33 Workday employers waiting in `docs/job-feed-plan.md`, USAJOBS
   (needs Jake's free key), and city filters so non-tech users see local jobs first.
9. **Job alerts by email:** "new jobs that fit you" daily or weekly. The reason to stay
   subscribed between searches.

### February to April: deepen

10. **LinkedIn profile helper:** headline and About section from the master resume,
    fact-guarded.
11. **Interview prep upgrade:** practice answers to the likely questions, scored against
    your own resume.
12. **Mobile polish** (most job seekers browse on phones even if they apply on desktop).
13. **Teams/coach view** (feeds the B2B line below).

## 5. Making more money (without hurting trust)

| Stream | What | When | Fit with trust |
| --- | --- | --- | --- |
| **Core plans** | $29 pass, $15 monthly (settled, don't change) | Now | Core |
| **Coach and partner seats** | Career coaches, bootcamps, colleges, workforce centers, outplacement firms buy seats (say $10 to $20 per job seeker, or a monthly plan per coach). One coach brings 10 to 50 users | Pilot in January, after 50+ real users | Strong: we help their clients |
| **Employers: featured jobs** | Small employers (restaurants, clinics, shops) pay to feature a job to people who actually fit it | Only after real traffic (thousands of active users) | Good if labeled "Featured" and still ranked by fit |
| **Employers: post a job** | A full job board side | Much later; two-sided markets are hard for a solo founder | Neutral |
| **Affiliates** | Recommend things job seekers really need (a course, a cert) for a commission | Maybe later, clearly labeled | Risky; only if we'd recommend it anyway |
| **$REWORK token** | Burn for Pro is the only token feature (settled). No holder perks or discounts without a lawyer. Token talk stays on `/token`, never in the product flow | When Jake decides to launch it; not needed for the business | Keep it separate so it can't hurt the product brand |
| **Display ads** | Banner ads in the app | **No.** Pennies per user, cheapens the brand, and ad networks track users | Bad |
| **Selling data** | Never | Never | Would end the business |

**The big one is B2B (coaches, schools, workforce centers).** Consumers search for a few
months then leave; organizations buy every year. It also makes ReWork much more
attractive to an acquirer.

## 6. Safe, clean, trustworthy

- **Privacy:** resumes are sensitive. Keep: no data selling, delete-my-account works,
  Anthropic doesn't train on it. Add: auto-delete accounts inactive for 2 years (say so in
  the privacy policy), and a short security page.
- **Fact guard is sacred:** run the eval (`npm run eval:models`, billed, ask first) after
  any prompt change. Post the "Invented: 0" stats.
- **Honest marketing:** no "guaranteed interviews", no fake reviews, testimonials only
  with consent and never paid for good outcomes (FTC rule).
- **Money safety:** AI ceilings stay; Anthropic hard limit stays; refunds within 7 days.
- **Account safety:** 2FA on Google, Stripe, Vercel, Supabase, GitHub, X, ImprovMX.
- **Security reviews:** a quick audit before each big feature (the pattern we already
  use), dependency updates monthly (never `npm audit fix --force` without asking).
- **Legal:** terms and privacy are live. Before B2B deals: a simple data agreement
  template. Before token perks: a lawyer.

## 7. Built to sell one day (even if we never do)

What makes a small product worth buying:
1. **Revenue that recurs**, ideally some B2B contracts.
2. **Users who stay and say nice things** (we collect every one).
3. **Clean ownership:** an LLC owns the domain, code, Stripe and accounts. Clean books.
4. **A moat:** the fact guard, our eval set, the job feed and match data. Keep them
   documented (they are).
5. **Low dependence on one person:** the docs we keep (`PROJECT.md`, `STATE.md`) already
   help; a buyer can read how it works.

Likely buyers later: job boards (Indeed, ZipRecruiter), resume tools (Teal, Rezi, Kickresume),
HR tech, career-services companies. Not a goal for now; a reason to keep things clean.

## 8. Decisions only Jake can make

1. **LLC and a business bank account:** when? (Suggest: before the first $1k.)
2. **Email provider (Resend, free tier, new account):** OK to set up in December?
3. **Coach/partner pilot:** do you know any career coaches, bootcamp or college career
   offices to ask first? One warm intro beats 100 cold emails.
4. **Token launch:** still planned? It's separate from everything above and not needed
   for the business to work.
5. **Time budget:** how many hours a week can you give marketing? The plan above assumes
   about 1 hour a day.

## Next 7 days

| Day | Jake | Claude |
| --- | --- | --- |
| Sat-Sun Nov 21-22 | Rest; record the demo if there's energy | Signup-source tracking PR |
| Mon Nov 23 | Launch on X and LinkedIn, answer replies | Watch `/admin`, fix anything |
| Tue-Wed | One Reddit post (r/SideProject), reply on X | Fix what users hit; weekly-review template |
| Thu Nov 26 | Thanksgiving, off | Nothing urgent |
| Fri Nov 27 | One "what we learned" post | First weekly numbers |
