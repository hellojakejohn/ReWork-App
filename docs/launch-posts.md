# Launch posts and replies

Drafts for Jake to post from his own accounts. Nothing here is posted by Claude.
Product only: no token talk in any of these (docs/token-plan.md keeps the two apart).
Swap in your own words wherever it sounds less like you.

## The facts every post leans on (keep them true)

- rework.careers. Upload your resume, see open jobs that fit you, ranked by your real match.
- One click tailors your resume to a job in about a minute, plus a cover letter and answers.
- A fact guard checks every rewrite against your real resume: no invented employers,
  titles, dates, numbers, tools or degrees. What it can't back up, it removes or flags.
- It shows the keywords it couldn't add because you don't have them. Honest misses.
- 25,000+ open jobs, pulled daily from employers' own boards (Greenhouse, Lever, Ashby,
  SmartRecruiters, Workday). Tech, but also hospitals, retail, restaurants, logistics.
- It never applies for you. You read it and press submit yourself.
- Free: 3 tailored resumes and 1 cover letter a month, no card.
  Job Hunt Pass: $29 once for 90 days, never renews. Pro Monthly: $15.
- Built solo in Saint Paul, MN.

Don't say: "unlimited", "beats the ATS", "ATS score", "guaranteed interviews".

## Assets to have ready

- 45-second screen recording: upload, matches appear, tailor one, download the PDF.
  Demo files: `docs/demo/marcus-hill-resume.pdf` + `docs/demo/ops-coordinator-job.txt`
  (a restaurant manager going for an ops coordinator role, so it isn't only tech).
- One screenshot of the Result card's "Your receipt" (what changed, what was left out).
- One screenshot of a match card with the "Tailoring can lift this to X%" bar.
- The OG card already shows "Same you. Better fit." when the link is pasted.

## X (thread)

1/
AI is taking jobs. I built something that helps you take one back.

rework reads your resume, finds open jobs that actually fit you, and tailors your resume
to each one in about a minute.

Without making anything up. rework.careers

[video]

2/
Most AI resume tools will happily invent a certification, a bigger team, a 40% increase.
That's how you get caught in an interview.

rework checks every rewrite against your real resume. If your resume doesn't back it up,
it doesn't go in.

3/
It also tells you what it couldn't add.

"This job wants Salesforce. You don't have it, so we left it out." That's more useful than
a fake match score.

[receipt screenshot]

4/
The jobs come straight from employers' own boards, checked daily, so closed jobs drop off.
25,000+ right now, and not only tech: hospitals, retail, restaurants, logistics.

5/
It never applies for you. You get the resume, cover letter and answers ready, you read
them, you hit submit.

6/
Free: 3 tailored resumes a month, no card.
Searching hard? $29 once for 90 days. It never renews.

Built solo in Saint Paul. I read every reply.
rework.careers

## LinkedIn

I spent the last few months building rework, and today it's live.

The idea came from watching people I know apply to 100+ jobs with the same resume, then
watching AI tools "fix" that by inventing things they never did. Bigger numbers, tools
they never used, a team they never led. It reads great until the interview.

So rework does two things:

1. It finds open jobs that fit you. Upload your resume and you get a ranked list from
   employers' own job boards, 25,000+ and growing, in and outside tech.
2. It tailors your resume to each one in about a minute, and checks every line against
   what you actually wrote. If your resume doesn't support it, it doesn't go in. It even
   tells you which keywords it left out because you don't have them.

It won't apply for you. You read it, you press submit.

Free to start (3 tailored resumes a month, no card). If you're in a real search, it's $29
once for 90 days.

If you're job hunting, or know someone who is, I'd love for you to try it and tell me
what's broken: rework.careers

## Reddit

Rules first: r/resumes and r/jobs ban self-promotion. Post only where it's allowed and
say plainly that you built it. Good fits: r/SideProject, r/alphaandbetausers,
r/jobsearchhacks (check the weekly self-promo thread), r/careerchange (ask the mods first).

**Title:** I built a resume tailor that refuses to make things up. Looking for honest feedback.

**Body:**
I'm a solo dev. I kept seeing AI resume tools invent stuff (fake metrics, tools people
never used), so I built one that checks every rewrite against your original resume and
drops anything it can't back up.

What it does:
- Upload your resume, get open jobs ranked by how well you actually match
- Tailor your resume to one in about a minute, with a cover letter
- Shows what it changed and why, and what it left out because you don't have it
- Never applies for you

Free tier is 3 tailored resumes a month, no card. rework.careers

I'd really like to hear where it falls short, especially if you're outside tech. What
would make this useful for you?

## Indie Hackers / Show HN

**Show HN: rework, a resume tailor with a deterministic fact guard**

rework tailors a resume to a job posting with an LLM, then runs plain code over the result
before you see it: every employer, title, date, number, tool and credential in the output
has to trace back to the original resume, or it's removed or flagged. The model can
reword; it can't invent.

It also pulls open jobs daily from Greenhouse, Lever, Ashby, SmartRecruiters and Workday
boards (25k+ right now) and ranks them against your resume with a weighted keyword match,
so you see fit before you spend a tailor.

Next.js, Postgres, Claude for the rewriting. Solo project. Free tier, no card:
rework.careers. Happy to go deep on the fact guard or the job feed.

## Product Hunt

- **Tagline:** Find jobs that fit. Get a resume tailored to match, honestly.
- **Description:** Upload your resume and see open jobs ranked by your real match. Tailor
  to any of them in about a minute, with a cover letter and answers. A fact guard checks
  every line against your real resume, so nothing gets invented.
- **First comment:** Hi, I'm Jake. I built rework because AI resume tools kept making
  things up for people, and that falls apart in the interview. rework rewrites, but every
  claim has to come from your resume. It also shows you the keywords it couldn't add.
  Free to start. I'm here all day, tell me what's broken.

## Replies

**"Isn't this just ChatGPT?"**
The rewriting uses an AI model, yes. The difference is what happens after: plain code
checks every employer, date, number and tool against your real resume and removes
anything it can't back up. ChatGPT will happily give you a certification you don't have.

**"Will it get me past the ATS?"**
Nobody can honestly promise that. What it does: single-column templates, standard
headings, real text in the PDF, and a plain Word file on Pro, which is what application
systems read best. And it uses the job's own words where your experience matches them.

**"What happens to my resume / data?"**
It's stored so it's there when you come back. The text goes to Anthropic's paid API for
the rewrite, and they don't train on it. We never sell it or share it with employers.
You can download everything or delete your account from Settings any time.

**"Why pay when there's a free tier?"**
Free is enough to try it on a few jobs. If you're applying to a lot, the $29 pass covers
90 days and never renews, which is less than two months of most resume tools.

**"Does it apply for me?"**
No, on purpose. Mass auto-apply is how people end up spamming jobs they don't fit. You
get everything ready to paste, and you hit submit.

**"It didn't work with my job link."**
Sorry about that. LinkedIn, Indeed and Glassdoor block apps from reading their pages, so
for those, paste the description or use the Save to ReWork button. If it was another
site, send me the link and I'll look at it today.

**"It changed something I didn't want changed."**
Every changed bullet has a revert button and the reason it changed. If it got something
wrong, I'd love the details so I can fix it for everyone.

**"It's a bit expensive."**
Fair. The free tier stays free (3 tailored resumes a month). The pass is a one-time $29,
no subscription to forget about.

**"Refund?"**
Ask within 7 days of any payment and I'll refund it (the one exception is a Job Hunt Pass
you've already used, per the terms). Just reply or email support.

**Bug report**
Thanks for telling me, that really helps. Can you share what you clicked and what you
saw? A screenshot is perfect. I'll fix it and let you know.

**Harsh feedback**
Thank you, honestly. That's exactly what I need right now. [Answer the specific point, or:]
I'm going to look at that this week.

## Order on the day

1. Post X and LinkedIn in the morning (Central).
2. Reddit and Indie Hackers an hour later, one sub at a time, spaced out.
3. Show HN on a weekday morning, US time. Product Hunt on a separate day, 12:01am Pacific.
4. Answer every reply for the first few hours. Watch `/admin` for signups, errors and AI spend.
