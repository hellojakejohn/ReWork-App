# Week 1 posts (Nov 23-29): lead with the free tools

Drafts for Jake's own accounts; Claude never posts. Swap in your own words. Keep every claim
true: no "guaranteed interviews", no competitor named with a price, no "beats the ATS".
Live only after PRs #87 (`/check`), #88 (`/jobs`) and #89 (matcher) are merged and deployed.

## Facts these posts lean on (all checked Nov 22)

- `/check` is free, no sign-up, no AI, saves nothing. It shows scam signs, ghost-job signs,
  and for Greenhouse, Lever, Ashby, SmartRecruiters and Workday links, whether the job is
  still on the employer's own board (we pull those every morning).
- A Nov 2026 ResumeBuilder survey: 86% of recent job seekers say they've seen a ghost job.
- Sample restaurant manager resume vs an operations coordinator job: 40% match before,
  66% after tailoring, 0 things invented (our eval, Nov 22). It's a sample resume, say so.
- 33,000 open jobs from employers' own boards, refreshed daily. `/jobs` has 35 roles.

## X: launch thread (Mon or Tue)

1/
86% of job seekers say they've applied to a ghost job: a posting nobody is hiring for.

I built a free checker. Paste the link, and it tells you if the job is still on the
employer's own job board, plus any scam or ghost-job signs.

No sign-up. rework.careers/check

[screen recording of /check]

2/
How it works: we pull thousands of companies' job boards every morning. If a job came off
the company's own board but it's still up on other sites, that's the tell.

It also flags the scam stuff: "pay for your equipment", "text us on Telegram", "send your
SSN up front".

3/
It's part of ReWork, the resume tailor I've been building that won't make things up.

A sample restaurant manager resume went from a 40% match to 66% for an ops coordinator
job. Nothing invented: every line traces back to the original.

4/
Free: the job checker, a fit check, and 3 tailored resumes a month.
Searching hard? $29 once for 90 days, never renews.

Built solo in Saint Paul. Tell me what's broken. rework.careers

## LinkedIn (Tue or Wed)

Have you ever spent an evening on an application, then heard nothing, and later found out
the job was already filled?

Most job seekers have. In a survey this month, 86% said they'd run into a "ghost job".

So I built a free checker into ReWork: paste a job link and it tells you whether the job is
still on the employer's own job board (we check thousands of them every morning), and
whether the post has the classic scam or ghost-job signs. No sign-up, nothing saved.

rework.careers/check

And if the job is real: ReWork tailors your resume to it in about a minute, using only what
you've actually done. A sample restaurant manager went from a 40% match to 66% for an
operations coordinator role, with nothing made up.

If you're job hunting, or know someone who is, I'd love to hear what it gets wrong.

## Reddit (r/SideProject, or a sub's self-promo thread; read the rules first)

**Title:** I built a free ghost-job checker: paste a job link, see if it's still on the
company's own board

**Body:**
Solo dev here. My app pulls thousands of companies' job boards every morning (Greenhouse,
Lever, Ashby, SmartRecruiters, Workday). That means it can tell when a job has come off the
employer's own board even though job sites still show it.

So I made a free page: paste a link (or the post text) and it shows:
- whether it's still on the employer's board (for those systems)
- scam signs (pay to start, chat apps, SSN or bank details up front, crypto)
- ghost-job signs (old or reposted, "talent pool" wording, agency ads, no pay listed)

No sign-up, no AI, nothing saved: rework.careers/check

It's not a verdict, just facts with a reason for each. What else would you want it to check?

## Replies to ghost-job and scam posts (help first, link only if it fits)

- "Check whether the role is still on the company's own careers page. If it's gone there but
  still up on job sites, it's likely filled. I built a free checker that does this for a lot
  of companies if you want to paste the link: rework.careers/check"
- "Red flags: asking you to buy equipment, moving to Telegram or WhatsApp, a check before
  you start, SSN or bank details before an offer. Real employers don't do those."

## Weekly job drop (every Friday)

Run this from the repo (read-only), then paste the output as a post:

```bash
npx tsx --tsconfig tsconfig.json scripts/job-drop.ts --count 10
```

It picks 10 recent jobs that list pay, one employer each, non-tech roles first, with a link
to the role page. `--role restaurant-manager` for one role.
