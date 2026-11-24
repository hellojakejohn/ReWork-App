# Weekly "Your measurements" email (plan, Nov 22)

Every Monday morning: the best new jobs for each person's resume this week, each with its
fit on a tape measure and one tap to tailor. The reason to come back, and to stay Pro
between searches.

## Daily brief (Nov 24)

Settings > Email picks **Off / Weekly / Daily**. Daily people get the same email each
morning (`/api/cron/daily-email`, 13:00 UTC, three passes 20 minutes apart, after the 12:30
job pull), with "today" and "since yesterday" in the wording, at most once per 20 hours.
Nothing new since yesterday = no email. The Monday weekly run skips them. Same
`EMAIL_WEEKLY` switch, same unsubscribe. Needs `docs/sql/paste-2026-11-24.sql` (one
column, `email_prefs.daily`); until then everyone stays weekly.

## What the email says

Subject: **Your measurements this week: 5 new jobs that fit**

- One line: "We checked 33,000 open jobs against your resume. These fit best."
- Up to 5 jobs: title, company, place, pay if known, the fit as a small tape image, and the
  top skills that fit. Button: **Tailor for this job** (opens the job in ReWork).
- If they have tracked jobs: "2 follow-ups due" with a link to the tracker.
- Footer: why they got it, **one-click unsubscribe**, the mailing address, support@.

## How it works

1. **Cron** `/api/cron/weekly-email`, Mondays 13:00 UTC (8 am Central), with the same
   `CRON_SECRET` check as the job pull.
2. **Who gets it:** users with an active resume, a "what job do you want next" answer, email
   on (new `emailWeekly` setting, on by default for new sign-ups, with the choice shown at
   sign-up and in Settings), and who opened ReWork in the last 90 days.
3. **The jobs:** reuse the matching we already run (`src/lib/feed/`), only jobs first seen
   since their last email, not dismissed, not already tracked. List boards are already
   pulled daily, so most matches cost nothing; Workday search and the keyword reads for
   new jobs cost a few cents per person. Capped by the existing free daily AI ceiling.
4. **Send** through Resend in batches; log `weekly_email` events (sent, skipped, why) for
   `/admin`; remember `lastWeeklyEmailAt` per user.
5. **Unsubscribe:** a signed link (no sign-in needed) plus the `List-Unsubscribe` and
   `List-Unsubscribe-Post` headers so Gmail shows its own unsubscribe button.

## Rules we follow

- **CAN-SPAM:** clear sender, honest subject, unsubscribe that works in one click and is
  honored right away, and a **physical mailing address** in every email (a PO box or a
  virtual mailbox is fine; Jake's home address shouldn't go in).
- **Privacy policy:** add Resend as a processor and the weekly email to "How we use it".
- Never the resume text in the email; jobs and fit numbers only.

## What Jake needs to do (about 15 minutes)

1. Resend: add the domain **send.rework.careers** (a subdomain, so it doesn't touch the
   ImprovMX records on the main domain). Paste the DNS records Resend shows into Vercel
   Domains.
2. Create an API key in Resend and paste it into Vercel as `RESEND_API_KEY` (Production).
3. Pick a mailing address for the footer (PO box or virtual mailbox).
4. The SQL for the two new user columns (`emailWeekly`, `lastWeeklyEmailAt`) and the
   referrals SQL, pasted together in Supabase.

## Build order once that's done (about a day)

1. Settings toggle and the sign-up choice; the SQL.
2. The email itself (React Email or plain HTML, the brand look, the tape image from
   `/api/og`), a preview page in `/admin`, a "send me a test" button.
3. The cron, dry run first (log who would get what), then live for Jake's account only,
   then everyone.
4. Welcome email on sign-up (same pipe).
