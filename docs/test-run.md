# ReWork test run

One pass through the whole product on prod, about 40 minutes. Works as a screen recording too.
Mark each step pass or fail, with a note on anything off (a screenshot is enough).
If you see an error, copy its exact text: it tells Claude where the problem is.

## Before you start

- PR 47 merged and the first job pull run (`docs/jake-todo.md` items 1 and 2). Steps 4 and 5
  need them.
- Use a **fresh Google account** in a private window for a true new-user run. Free limits:
  3 tailors, 1 cover letter, 3 application answers, 1 interview prep a month.
- **Recording:** use the demo files so nothing personal shows:
  - `docs/demo/marcus-hill-resume.pdf` (a made-up restaurant manager)
  - `docs/demo/ops-coordinator-job.txt` (the job he's going for)
  - Full-screen Chrome at about 1440 wide, bookmarks bar hidden except Save to ReWork.

## The run

| # | Do | Expect |
|---|----|--------|
| 1 | Open rework.hellojakejohn.com | The landing page loads fast. Get started, Pricing, Terms and Privacy all work. |
| 2 | Get started, then sign in with Google | You land on the dashboard on the Resume card. |
| 3 | Upload `marcus-hill-resume.pdf` | It reads the file in under a minute. Name, both jobs, school and skills are right. Any "things to check" dots point at real fields. |
| 4 | "What job do you want next?": type Operations Coordinator, pick Remote or near me | Top matches show up in under a minute: real jobs, mostly in Minnesota or remote, each with a % and pay when the ad names it. Free shows 5 and "N more with Pro". |
| 5 | Tap Not for me on one match, Save on another, then Tailor on a third | Not for me hides it. Save sticks after a refresh. Tailor fills the Job card with the full job post. |
| 6 | Job card, the backup path: paste a real Greenhouse or Lever link | Title, company, description and pay fill in. The title has no "- Company" tacked on. |
| 7 | Job card: "Paste the description instead", paste the demo job text | It saves. "Show the full description" only appears if the text is long. |
| 8 | Tailor card | "Your resume" then "Tailored for this job". The fit check shows a % and "X of Y things this job asks for". |
| 9 | "Have you done any of these?": answer one Yes with a note (for example "Coordinated vendor schedules daily at Riverside Grill") and one A little | The review shows only what you said, placed sensibly. Add them and the % goes up. |
| 10 | Tailor | The stages stream past, done in about a minute. |
| 11 | Result card | The receipt shows **Job match X% → Y%**, then Improvements kept, Keywords added, Left out, and Invented 0. |
| 12 | Changes tab: revert one bullet, then keep it again | The preview updates each time. |
| 13 | Keywords tab | Covered and missing keywords, plus "Have you done any of these?" for the missing ones. |
| 14 | Cover letter tab: write one | Addressed to the right company, no facts that aren't in the resume. |
| 15 | Questions tab: tap "Why do you want to work here?", Medium. Then ask "What salary do you expect?" | The first answer uses only resume facts. The salary one gets a note saying the resume can't answer it, not a guess. Copy, Edit and Delete work. |
| 16 | Interview tab | 6 likely questions, each with "Your proof" quoting real bullets, gaps shown as gaps, plus questions to ask them. |
| 17 | LinkedIn tab | Headline, About, each role and Skills, each with Copy. |
| 18 | Download the PDF in Classic, then Modern | Both open cleanly: the name doesn't overlap the headline, the contact line has no stray "\|". |
| 19 | Download Word | Free gets the upgrade sheet. Pro gets a .docx that opens in Word or Google Docs. |
| 20 | Apply at {company} (on a match from step 5) | The real application page opens. With extension 0.2.0, the form fills (contact, resume PDF, letter) and nothing is submitted. Without it, the page still opens. |
| 21 | Tracker (the board icon) | The job is there, with pay. Drag it to Applied and it stays after a refresh. Drag one to Interview: it gets a Prep button. |
| 22 | Home | Recent jobs and top 3 matches show. A job 7+ days in Applied shows under Follow up (you may not have one yet). |
| 23 | Go to rework.hellojakejohn.com/save, drag the button to your bookmarks bar | The page explains it. Clicking the button on that page only tells you to drag it. |
| 24 | Open a LinkedIn job you're signed in to, click Save to ReWork | A ReWork tab opens on the Job card with title, company and full description. **No one has tested signed-in LinkedIn yet.** |
| 25 | Same on an Indeed job | Same result. If something is missing, select the description text and click again. |
| 26 | Phone: open the site and sign in | Every card fits with no sideways scrolling, buttons are easy to tap. Check the matches list too. |
| 27 | Account menu, Settings, Your data, Download my data | A JSON file with your resume and jobs. |
| 28 | Signed in as you: open /admin | Signups, tailors, AI spend, errors and the Job matches box (last pull, open jobs). The test run shows up there. |

## Money (after Stripe live, `docs/jake-todo.md` items 3 to 5)

| # | Do | Expect |
|---|----|--------|
| 29 | Buy the $29 Job Hunt Pass with a real card | Pro right away: 50 matches, Word download, no monthly limits. |
| 30 | Refund it in Stripe | Pro goes away within a minute (the webhook). |
| 31 | Subscribe at $15/month, then cancel in Manage billing | Pro stays until the period ends; Settings says when. |
