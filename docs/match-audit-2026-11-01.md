# Match score audit, Nov 1 2026

Trigger: one job (Trane, Sr. Applications Developer) and one resume tailored three times
gave 43% -> 36%, 38% -> 56% and 26% -> 32%. The Keywords tab called Front-End, Back-End,
SQL and Testing "not in your resume" when the resume says frontends, backends, PostgreSQL
and tests.

## Pipeline

1. Fit check (`/api/resumes/[id]/skill-check`): one model call lists the job's 10-20
   keywords, scored against the master. Cached in the browser tab only.
2. Tailor (`/api/resumes/[id]/tailor`): sends the fit keywords (if the fit had finished)
   or lets the model pick its own, then fact guard, then coverage before/after.
3. Result: receipt and Keywords tab read the saved coverage.

## Findings, by impact

| # | Finding | Effect |
|---|---------|--------|
| 1 | The keyword list is re-picked by the model on every fit check and every tailor without one (reload, Tailor pressed before the fit finished, saving to the resume). | Same job, three different scores. Before/after numbers can't be compared across runs. |
| 2 | Matching is literal: "Front-End" misses "frontends", "Testing" misses "tests", "SQL" misses "PostgreSQL". | Real skills shown as missing; "Have you done any of these?" asks about things the resume says. Hurts trust in the receipt. |
| 3 | The tailor prompt says "do not copy phrases from the job description" and never says which keywords the resume supports. | The model avoids the job's exact words even where true, which is what an ATS scans for. Coverage barely moves. |
| 4 | The fact guard reverts a bullet that writes a supported keyword in the job's spelling ("Front-End", "SQL", "REST"), because the capitalized word isn't in the master. | The model is punished for the right move. |
| 5 | The model may drop skills and merge bullets; nothing puts back a job keyword the master showed. | The score can go down (43% -> 36%). |
| 6 | "Before" counts evidence answers (not printed) and the fit check doesn't; "after" skips skill group names (printed). | Before and after measure different things. |
| 7 | The summary is only checked for numbers, not for new tools or employers. | A summary could name a tool the resume doesn't have. |
| 8 | A re-fit of a job already tailored makes a new model call. | Wasted AI spend, and a new list. |

## Fixes in this PR

- 1, 8: reuse the keyword list from the user's last tailor of the same job description
  (fit check skips the model call; tailor reuses it when the fit didn't send one). Tailor
  waits for the fit check so the list on screen is the list scored.
- 2: matcher understands hyphen/space/joined forms (front-end, front end, frontend),
  simple word endings (test, tests, testing, tested) and a short list of honest
  implications (PostgreSQL shows SQL and relational databases).
- 3: the prompt lists which keywords the resume supports and asks for the job's exact
  wording for those, and never the others.
- 4: the fact guard accepts the job's spelling of a keyword the resume supports.
- 5: after the fact guard, a keyword the master showed and the tailored resume lost gets
  its skill or its original bullet put back.
- 6: before and after read the same kind of text (printed resume, no evidence notes,
  skill group names in both).
- 7: the summary gets the same new-name check as bullets.
