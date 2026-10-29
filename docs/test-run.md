# ReWork test run

One pass through the whole product, about 30 minutes. Works as a screen recording too.
Mark each step pass or fail, with a note on anything off (a screenshot is enough).

## Before you start

- Merge #25, #26 and #27 first. Steps 4, 7 and 11 need them.
- Use a **fresh Google account** for a true new-user run, in a private window. Your own
  account works too, but you may run out of the 3 free tailors.
- **Recording:** use the demo files so nothing personal shows:
  - `docs/demo/marcus-hill-resume.pdf` (a made-up restaurant manager)
  - `docs/demo/ops-coordinator-job.txt` (the job he's going for)
  - Use full-screen Chrome at 1440 wide or so, and hide the bookmarks bar except Save to ReWork.
- Free tailors used: 2. Cover letters used: 1.

## The run

| # | Do | Expect |
|---|----|--------|
| 1 | Open rework.hellojakejohn.com | The landing page loads fast. Get started works, and so do Pricing, Terms and Privacy. |
| 2 | Get started, then sign in with Google | You land on the dashboard on the Resume card. |
| 3 | Upload `marcus-hill-resume.pdf` | It reads the file in under a minute. The name, both jobs, school and skills are right. Any "things to check" dots point at real fields. |
| 4 | Job card: paste a real Greenhouse or Lever link (any job) | The title, company and description fill in. The title has no "- Company" tacked on. |
| 5 | Back on the Job card, choose "Paste the description instead" and paste the demo job text (first line is the title, second line the company) | It saves. "Show the full description" only appears if the text is long. |
| 6 | Tailor card | It says "Your resume" then "Tailored for this job". The fit check shows a percent and "X of Y things this job asks for". |
| 7 | Tap "Have you done any of these?" Answer one Yes with a note (for example "Coordinated vendor schedules daily at Riverside Grill") and one A little | The review screen shows only what you said, placed sensibly. Add them, and the fit percent goes up. |
| 8 | Tailor | The stages stream past, done in about a minute. |
| 9 | Result card | The receipt shows **Job match X% → Y%** at the top, then Improvements kept, Keywords added, Left out, and Invented 0. |
| 10 | Changes tab: revert one bullet, then keep it again | The resume preview updates each time. |
| 11 | Keywords tab | You see covered and missing keywords, plus "Have you done any of these?" for the missing ones. |
| 12 | Cover letter tab: write one | It's addressed to the right company, and uses no facts that aren't in the resume. |
| 13 | Download the PDF in Classic, then Modern | Both open cleanly: the name doesn't overlap the headline, and the contact line has no stray "\|". |
| 14 | Download Word | A free account gets the upgrade sheet. A Pro account gets a .docx that opens in Word or Google Docs. |
| 15 | Tracker (the board icon) | The job is there. Drag it to Applied and it stays after a refresh. |
| 16 | Go to rework.hellojakejohn.com/save and drag the button to your bookmarks bar | The page explains it. Clicking the button on that page only tells you to drag it. |
| 17 | Open a LinkedIn job you're signed in to, then click Save to ReWork | A ReWork tab opens on the Job card with the title, company and full description. **This is the big one: no one has tested signed-in LinkedIn yet.** |
| 18 | Same on an Indeed job (from search results or a job page) | Same result. If something is missing, select the description text and click again. |
| 19 | Phone: open the site and sign in | Every card fits with no sideways scrolling, and the buttons are easy to tap. |
| 20 | Account menu, then Settings, then Your data, then Download my data | You get a JSON file with your resume and the job. |

If you see the exact error text from a failed step, copy it, since it tells me where the problem is.

## Tonight: Stripe (with me, about 20 min)

The steps are in `STATE.md` under "Next session". After that, buy one real Job Hunt Pass and refund it.
