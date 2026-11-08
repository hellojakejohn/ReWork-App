# Job feed: jobs that match you

Written 2026-11-07 with Jake. Status: **idea, not started.** First big feature after launch.
Out of scope for launch (docs/PROJECT.md), so it starts once launch week is calm.

## The idea

Job search, inverted: instead of you searching for jobs, ReWork finds the jobs that fit your
resume and ranks them by an honest match. Then one tap tailors the resume, writes the cover
letter and answers the application questions, and the job lands in the tracker.

The loop:

1. Upload a resume.
2. Refine it (skill check, evidence interview, "Fix something"). This also teaches the feed
   what you have really done, so better resume = better matches.
3. ReWork pulls fresh jobs and scores each against each of your resumes.
4. Home shows "Top matches for you": 5, 10, 20+ jobs with a match % and what's missing.
5. Per job: Tailor, Cover letter, Application answers, Track. Then the next job.

Each resume card on Home (PR #42: "SWE", "Blockchain") becomes its own saved search, so the
labels turn into the feed's tabs.

## Why it's worth it

- The hard part already exists: tailoring, the fact guard, the Job match, the tracker, scam
  and ghost-job checks. The feed keeps feeding them jobs.
- It gives people a reason to open ReWork every day, not once per job.
- It's the stickiest feature for a job seeker and makes Pro worth more.

## Be honest about

- **Not new.** Jobright.ai and Simplify already do "AI finds jobs, then tailors." Our pitch
  is matching you can trust: real match % with the gaps shown, facts checked, ghost and scam
  jobs filtered out. Not "we find jobs".
- **Quality beats volume.** Stale, duplicate or fake listings kill trust fast. Fresh and real
  matters more than many.
- **Coverage leans tech at first.** The free sources are strongest for tech and remote roles.
  Career changers (restaurant manager to ops) get thinner lists until more sources are added.

## Where jobs come from

Allowed and free:
- **Company job boards on the ATSs the resolver already reads** (`src/lib/job-resolve/ats.ts`):
  Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Workday, BambooHR, Oracle. Their public
  board APIs list every open job per company. Needs a list of company boards to poll (start
  with a few hundred, grow it).
- **Job APIs:** Adzuna (free tier, broad US coverage), USAJobs (federal), remote boards with
  public feeds (Remotive, RemoteOK, We Work Remotely). Check each one's terms before use.

Not allowed: LinkedIn and Indeed (scraping breaks their terms; LinkedIn is never fetched,
a settled decision). Users can still bring those in with Save to ReWork.

## How matching works (cheap by design)

1. **Pull** jobs on a schedule (Vercel cron, daily or twice a day). Dedupe by company + title +
   location; drop jobs older than ~30 days or gone from the board.
2. **Prefilter for free:** title and skills overlap with each resume, location / remote,
   seniority. No model.
3. **Keywords once per job, shared by everyone.** The Job match needs a job's 10-20 weighted
   keywords, which today come from one model call per job (`src/lib/job-keywords.ts`). For the
   feed, extract them once per job on Sonnet and store them on the job, reused for every user.
   Only jobs that pass someone's prefilter get extracted.
4. **Score** with the existing `keywordCoverage` / `weightedScore`
   (`src/lib/keyword-coverage.ts`): deterministic, no model, effectively free per user.
5. **Filter** with `scamSignals` and `ghostSignals` (`src/lib/job-checks.ts`).
6. AI money is only spent when someone taps Tailor, and that already goes through the caps.

Cost to measure in the spike: Sonnet keyword extraction per job (rough guess: well under a
cent) x new jobs per day. Put it behind its own daily ceiling, like `AI_FREE_DAILY_USD`.

## MVP (about a week)

- New tables: `Job` (source, external id, company, title, location, remote, pay, posted at,
  description, url, keywords, signals, last seen) and `JobMatch` (user, resume, job, score,
  missing keywords, dismissed / saved). Migration pasted by hand in Supabase, as always.
- Cron route that pulls from 2-3 sources to start (Greenhouse + Lever + Ashby boards, plus
  Adzuna), dedupes, extracts keywords for new jobs.
- Scoring run after each pull and when a resume changes.
- Home: "Top matches for you" section, per resume tab: title, company, location / remote, pay
  if listed, match %, top missing skills, Tailor button (opens the Job card prefilled), Not for
  me (dismiss, teaches the filter), Save to tracker.
- Small preferences on each resume card: location / remote, seniority, salary floor.
- Admin: jobs pulled per source, matches shown, tailors started from the feed, extraction spend.

Later: more sources and company lists, a daily or weekly email digest of new matches (needs an
email provider), "why this match" explanations, learning from dismissals.

## Pricing (prices stay as they are)

$29 pass and $15 monthly are settled. Put the feed inside the tiers instead of raising prices:
- Free: top 5 matches a week.
- Pro (pass or monthly): the full daily feed.

Revisit price only after real usage shows the feed is what people pay for.

## Other ideas from the same chat (Nov 7)

Quick wins:
- **Follow-up nudges:** "Applied 7 days ago, no reply: here's a short follow-up email." Answers
  the #1 complaint (no reply). Already on the roadmap.
- **Pay from the job post:** pull the salary range out and show it on the Job card and tracker.
- **Copy for LinkedIn:** the tailored summary and top bullets as plain text in one tap.

Medium:
- **Application answers** (built Nov 8, PR pending): paste "Why do you want to work here?" and get an answer built only
  from your resume, through the prose fact guard (`src/lib/text-facts.ts`). Fits the feed's
  per-job buttons.
- **Interview prep from the job** (built Nov 8, PR pending): the 5 likely questions and which of your bullets answer each.
- **Weekly email:** applied this week, follow-ups due, new matches. Needs an email provider.

Parked:
- Public "verified resume" link (Jake: not interested for now).
- Midnight privacy proofs ("I have this degree" without the details): neat, but recruiters and
  job sites don't check such proofs today. Revisit with a partner or token reason.
- Animations and polish: after the value features.

## Suggested order

1. Launch, then watch `/admin` for the first week.
2. Quick wins (follow-up nudges, pay, copy for LinkedIn) while the feed spike runs.
3. Feed spike: one source, a few hundred jobs, real scoring against Jake's resumes, measure
   extraction cost and match quality.
4. Feed MVP on Home, then Application answers as a per-job button.
