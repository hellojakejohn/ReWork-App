# Growth plan: 12 weeks, week by week (Nov 23, 2026 to Feb 14, 2027)

Written overnight Nov 21-22 after a fresh look at the app, the market and real numbers.
`docs/gameplan.md` (Nov 21) stays the big picture (business rhythm, money, trust rules,
selling one day). This file is the **what to do each week**, with what changed since.

## Where we really are (Nov 22, read from the database)

- **3 users, all ours.** 2 signups ever, 6 tailors, 1 test sale (refunded). No launch posts yet.
- **33k open jobs**, but heavy on tech companies. With strict titles there are only
  **10 real Operations Coordinator jobs**; Domino's is 519 of 564 customer service jobs and
  Raising Cane's 222 of 282 restaurant manager jobs. Our main users (non-tech, career
  changers) get thin, one-employer lists. USAJOBS has added 0 jobs so far (it fills on a match).
- **AI spend: $0.24 in two weeks.** Money is not the constraint; attention is.
- **Quality:** on the production path the tailor now lifts a restaurant manager's match for
  an ops coordinator job **40% to 66%** (Opus) with nothing invented (PR #89). That's the
  headline we wanted, and now it's true.

## The market (Nov 2026)

| Tool | What it is | Price for a 3-month search | Our edge |
|---|---|---|---|
| Teal | Tracker + resume builder | Teal+ about $79 / 90 days | Pay once is cheaper; fact guard; job feed |
| Jobscan | Match score diagnostics | about $90 / quarter | We fix it, not just score it |
| Rezi | ATS resume builder | $29/month or $149 lifetime | Rezi is reviewed for inventing numbers |
| Huntr | Tracker + tailoring | about $90 / 3 months | Honest misses, job feed |
| Jobright | Job matching + tailoring + autofill, our closest rival | about $90 / quarter | Non-tech jobs, fact guard, ghost/scam signs, no billing complaints |
| Simplify | Free autofill, Simplify+ for AI | about $90 / 3 months | We match and tailor honestly; they autofill |
| **ReWork** | **Matches + honest tailor + tracker + checks** | **$29 once, 90 days** | **About a third of the price** |

Prices are third-party listings, not checked on vendor sites: say "most tools charge $30 to
$40 a month", never a named competitor's price, in public copy.

What job seekers say (2026 surveys, vendor-run so treat as signals): 86% have hit a ghost
job (ResumeBuilder, Nov 17); 67% fear their resume is rejected before a human sees it; 80%
can tell AI-written text (hiring managers). Our trust angle fits all three.

**Brand note:** rework.com is Rework Inc. (a business software company) and "REWORK" is also
a well-known book. We will never rank for "rework" alone. Always say **ReWork** with
**rework.careers**, and grow through the free tools and role pages instead of the brand name.

## What changed overnight (PRs for Jake)

| PR | What | Why it matters |
|---|---|---|
| #85 | OpenAI code gone | Cleaner, fewer security warnings |
| #86 | Weekly "Your measurements" + welcome email (off until env set) | The reason to come back between searches |
| #87 | Free `/check`: ghost job + scam checker, incl. "still on the employer's board?" | A shareable tool nobody else has, timely hook |
| #88 | `/jobs` role pages (35 roles, live numbers) | SEO that compounds; stacked on #87 |
| #89 | Matcher: +28 points of honest lift for career changers | Makes the core promise true |

## The plan in one line

**Weeks 1-3: get the first 100 real users through free tools and one honest launch. Weeks
4-6: fix what they hit and fill the job gap for non-tech users. Weeks 7-10: January push.
Weeks 11-12: first partner pilot and a pricing-free look at conversion.**

North star: **paid customers per week.** Leading signals: signups per week, % who tailor
once, % who come back in week 2.

## Week by week

Each week: **Jake** (about 5 hours), **Claude** (builds in PRs), **Target** (the number that
says it worked). Mondays: 20-minute review in `/admin`, pick next week's one build.

### Week 1: Nov 23-29 (Thanksgiving week). Merge and launch quietly.
- **Jake:** merge #85 to #89 (#87 before #88). Pick the mailing address and set
  `EMAIL_MAILING_ADDRESS`, then `EMAIL_WEEKLY=dry`. Add rework.careers to Google Search
  Console and submit `/sitemap.xml` (10 minutes, free). Post the launch thread on X and
  LinkedIn (`docs/launch-posts.md`) Monday or Tuesday; skip Thursday.
- **Claude:** check USAJOBS fills on the first real match; fix whatever the first users hit;
  "Amsterdam, NH" location bug; `/check` share card (an image like `/s` cards).
- **Target:** 25 signups, 10 people tailor once, 0 errors in `/admin` that a user saw.

### Week 2: Nov 30-Dec 6. Lead with the free tools.
- **Jake:** one post a day on X: "86% of job seekers have hit a ghost job. I built a free
  checker that tells you if the job is still on the employer's own board" (with a screen
  recording of `/check`). Reddit, rules first: r/SideProject, r/jobsearchhacks self-promo
  thread. Reply to 10 job-search posts a day with help, not links.
- **Claude:** weekly email to `admins`, then `live` after Jake gets a good one. Welcome email
  on. Role pages: add "Check your fit for this kind of job" with the role's common keywords
  once enough jobs have keywords.
- **Target:** 75 total signups, 500 `/check` runs, first weekly email sent to real users.

### Week 3: Dec 7-13. Product Hunt + fill the job gap.
- **Jake:** Product Hunt launch on a Tuesday (copy in `docs/launch-posts.md`), be there all
  day. Get an Adzuna developer key (free tier, an aggregator with lots of non-tech jobs) if
  we want it; paste it in Vercel.
- **Claude:** Adzuna source (or more Workday/SmartRecruiters employers by industry: health,
  retail, logistics, local Minnesota employers) so non-tech roles have 50+ jobs from 10+
  employers. Move the biggest Workday employers from per-match search to the daily pull.
- **Target:** 150 total signups, 3 paid. Role pages for ops coordinator, customer service and
  restaurant manager each show 10+ employers.

### Week 4: Dec 14-20. Fix what people hit.
- **Jake:** email or DM every user who tailored once: "what almost stopped you?" (5 replies is
  enough). Post one before/after (with permission) or Jake's own.
- **Claude:** the top 3 fixes from feedback and `/admin` funnel. Shareable receipt image from
  the Result card ("40% to 66%, invented: 0").
- **Target:** week-2 return rate measured; activation (signup to first tailor) above 40%.

### Week 5: Dec 21-27. Holiday low: build the January kit.
- **Jake:** time off. Optional: record 5 short screen videos in one sitting for January.
- **Claude:** "New year job search" landing section; city filters on role pages (state
  pages like `/jobs/restaurant-manager/texas` only where 10+ jobs); weekly job drop post
  generator for Jake (10 good jobs from the feed, as text he can paste).
- **Target:** nothing new; keep errors at 0.

### Week 6: Dec 28-Jan 3. Warm up.
- **Jake:** "My 2027 job search kit" post. Schedule January posts (`postiz` or by hand).
- **Claude:** re-run the quality eval on more private resumes (non-tech, senior, long). Keep
  every number honest.
- **Target:** 250 total signups.

### Weeks 7-8: Jan 4-17. The January push (biggest job-search weeks of the year).
- **Jake:** daily posts (before/afters, ghost job finds from `/check`, weekly job drop), one
  Reddit post a week where allowed, Show HN on a Tuesday morning. If 10+ paying customers
  and a known signup-to-paid rate: a $100 Reddit or Google search test for "tailor resume
  to job" and "ghost job checker", kept only if a customer costs under $15.
- **Claude:** watch spend ceilings and raise the free daily AI ceiling if people hit it;
  fix fast; interview prep upgrade if users ask.
- **Target:** 1,000 total signups, 20 paid, under $5 AI per paying user.

### Weeks 9-10: Jan 18-31. Partners.
- **Jake:** reach 5 career coaches and 2 workforce centers (CareerForce in Saint Paul and
  Minneapolis is local). Pitch: free Pro for their clients for a month, we track outcomes.
  Federal money is flowing into AI job-seeker tools at American Job Centers this year.
- **Claude:** a coach view: invite clients, see their tracker counts (with consent), bulk
  Pro codes. Simple data agreement template for partners.
- **Target:** 1 pilot agreed.

### Weeks 11-12: Feb 1-14. Decide what's working.
- **Jake + Claude:** a one-page review: channel by channel (signups by source in `/admin`),
  conversion, retention, AI cost per paid user. Double down on the best two channels; drop
  the rest. Pricing stays settled; look at conversion copy and limits instead.
- **Claude:** LinkedIn profile helper (headline and About from the master resume, fact-guarded)
  if users asked for it; otherwise whatever the review says.
- **Target:** 2,000 total signups, 40 paid customers total, one partner pilot running.

## Where to promote (ranked for a solo founder, with what to post)

1. **X and LinkedIn (Jake's own accounts):** build in public, before/afters, ghost job finds,
   weekly job drops. Free tools are the hook: nobody shares a paywall, people share `/check`.
2. **Reddit:** rules first. Help in threads; post only in self-promo threads or where mods
   say yes. The ghost job checker is the most shareable thing we have there.
3. **Search (Google):** `/check` (ghost job checker), `/fit` (resume fit check), `/jobs/*`
   (role pages). Submit the sitemap; it compounds while we sleep.
4. **Product Hunt, Show HN, Indie Hackers:** one spike each, spaced weeks apart.
5. **Chrome Web Store** listing for Save to ReWork (Jake's $5 fee): free discovery.
6. **Partners:** career coaches, workforce centers, bootcamps, college career offices. One
   yes brings many users and is the path to yearly B2B revenue.
7. **Short video (TikTok, Shorts, Reels):** 30-second before/after screen recordings, from
   January.
8. **Paid:** only after 10+ customers and a known conversion rate; tiny tests only.

## Things Jake should decide (none urgent)

1. The mailing address for emails (blocks all email).
2. Adzuna (or similar) for non-tech jobs: OK to sign up for a free key?
3. Partners: any coach, workforce center or college you know personally? A warm intro beats
   everything.
4. How many hours a week for marketing through January (this plan assumes about 5).
