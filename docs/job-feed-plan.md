# Job feed: jobs that match you

Written 2026-11-07 with Jake. Status: **spike done Nov 8 (results below). Nov 8: Jake moved it
before launch as "matches on upload"** (build plan below). Launch waits for it.

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

## Build plan: matches on upload (decided Nov 8, before launch)

The new main flow: **upload a resume -> one question -> "Top matches for you" -> tap a job ->
tailor, letter, answers -> tracker.** Pasting a link stays as the backup. A feed job never
needs a link fetch: we already hold its full text, so LinkedIn and Indeed stop mattering.

The one question, right after the upload: **"What job do you want next?"** (prefilled from
the latest title; career changers type theirs) plus **Remote / near me / both**. Stored on
the resume, editable on its card.

Sources, all free and within their rules:
- Greenhouse, Lever, Ashby boards (built in the spike): tech and startups.
- **Workday** (checked Nov 8: Target 2,000+ jobs, 3M 781, public list API, no key): big
  employers, retail, health, manufacturing, banks. The non-tech answer. The list has title and
  location only; the full text is a second call, made only for jobs that pass someone's
  prefilter.
- SmartRecruiters (public list, e.g. Bosch 5,000+): later if Workday isn't enough.
- Company list: a few hundred boards in a checked-in file, grown over time, weighted to US
  employers across industries (Minnesota heavy at first is fine: it's who we test with).

Chunks (each tested, small commits, one PR):
1. **Tables** (SQL for Jake to paste): `jobs` (key, source, board, company, title, location,
   remote, us_state, pay label, posted, description, url, keywords, first/last seen, closed)
   and `job_matches` (user, resume, job, score, present/missing, seen, dismissed, saved).
   Resume gets `feed_prefs` (target titles, remote/near me).
2. **Daily pull** cron: boards in batches (fits the 300 s limit), upsert by key, mark jobs
   gone from the board as closed (the real ghost signal, instead of "30+ days old").
3. **Matching**: free prefilter over open jobs -> top 40 -> keywords (once per job, shared, own
   daily ceiling `AI_FEED_DAILY_USD`) -> real Job match -> save top matches. Runs after an
   upload, when prefs change, and after each daily pull. Sorted by the real match.
4. **Upload flow UI**: the question, then "Top matches" on the Resume card / Home: title,
   company, place, pay, match %, top missing skills, Tailor (fills the Job card with the full
   text), Not for me, Save to tracker. "Nothing good yet" said plainly, with what to change.
5. **Limits**: Free sees the top 5, Pro the full list (prices unchanged). `/admin`: jobs per
   source, matches shown, tailors started from a match, feed AI spend.
6. **Real-data check** before merge: the three fixtures plus Jake's own resumes, budget asked.
7. **Apply assist** (after 1-6): "Apply" opens the real application page and the Chrome
   extension fills it (contact, tailored resume, letter, saved answers); the user checks and
   clicks Submit, and the tracker marks it Applied. No auto-submit: ATS apply APIs need the
   employer's key, bots break site terms and hit CAPTCHAs, and recruiters flag mass applies.

Chunk 1 SQL: `prisma/migrations/20261109000000_job_feed/migration.sql` (checked Nov 8 on a
throwaway Postgres: runs twice clean, cascades on resume delete, RLS on, no anon access).
Download my data should include feed prefs and matches (chunk 3).

Jake's part: paste the SQL (chunk 1), set `AI_FEED_DAILY_USD` in Vercel, look at the screens.

## Spike results (Nov 8)

Run it again: `npm run feed:spike -- pull`, `-- rank` (both free), `-- score --max-usd 2`
(billed). Code: `src/lib/feed/` (board lists, prefilter), `scripts/feed-spike.ts`. Test people
are the 3 public fixtures, all in Saint Paul, remote or on-site in MN only.

**Pulling is free and fast.** 49 boards (34 Greenhouse, 5 Lever, 10 Ashby) gave 11,726 jobs
in 45 s, using the resolver's own parsers. 5 boards were empty (moved ATS). 60% list pay.
Of those, 1,749 are US remote or Minnesota after collapsing one role listed in many cities.

**Keywords cost $0.011 a job** (43 jobs, $0.48, median 2 s). 1,000 new jobs a day is about
$11/day before the prefilter, a few dollars after it. Fine behind its own daily ceiling.

**Tech matches are real.** Frontend dev: Ramp, Reddit, OpenAI, Notion frontend roles, 10 of
15 at 20%+. Solidity to backend: Linear, PostHog, OpenAI, Spotify full-stack, 11 of 15 at
20%+. For scale: the same resumes score 46% and 59% on the jobs they were built for, so the
feed's best (31-35%) is a bit below a hand-picked job, before tailoring.

**Career changers get almost nothing.** With no target title the restaurant manager gets one
real job (sweetgreen GM in Minneapolis, 29%). With "Operations Coordinator" as the target the
tech boards give ops jobs that need Salesforce, SOX or trust and safety: 0-11% match, against
36% on the right kind of job. Fixes: (1) ask "what job do you want next" on each resume
card, (2) add sources with non-tech jobs (Adzuna, USAJobs, local employers), (3) say plainly
when the feed has nothing good instead of showing 0% jobs.

**The free prefilter ranks loosely.** Rank agreement with the real match: 0.50 for the
frontend dev, about 0 for the backend switch, negative for the career changer (it puts
"Operations" titles first even when the work is unrelated). It's fine as a cheap gate (only
jobs scoring 30+ get extracted) but the feed must sort by the real match, never the
prefilter.

**Found and fixed on the way (live app too):** the scam check flagged 53 of 11,726 normal
posts ("processing costs", "GPU training costs", "send, receive, and move crypto", "does NOT
charge any fee"). Now 0.

**Still open for the MVP:**
- Ghost "old posting" signal: 69% of board jobs are 30+ days old (big companies keep roles
  open), so in the feed it would fire on most jobs. Use "gone from the board" instead.
- Keywords sometimes name the company's own product ("Supabase", "Codex", "GitLab Duo") or
  the job's own title ("frontend engineering" missed for a Frontend Developer). Those count as
  missing and pull scores down. Worth a prompt tweak checked with `npm run eval:match`.
- Board list: 49 hand-picked companies is tech-heavy. Need a few hundred, by industry.

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
- **Application answers:** paste "Why do you want to work here?" and get an answer built only
  from your resume, through the prose fact guard (`src/lib/text-facts.ts`). Fits the feed's
  per-job buttons.
- **Interview prep from the job:** the 5 likely questions and which of your bullets answer each.
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
