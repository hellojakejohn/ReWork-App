# Handoff, overnight Nov 21-22, 2026

Read `docs/PROJECT.md`, `STATE.md`, then `docs/growth-plan.md` (the week-by-week plan).

## Open PRs (merge in this order)

1. **#85** Remove OpenAI/OpenRouter code. No env changes.
2. **#86** Weekly "Your measurements" email + welcome email. Ships off. Needs
   `EMAIL_MAILING_ADDRESS`, then `EMAIL_WEEKLY=dry` -> `admins` -> `live`, and `EMAIL_WELCOME=1`.
3. **#87** Free `/check` ghost job + scam checker (no AI).
4. **#88** `/jobs` role pages. Stacked on #87: merge #87 first.
5. **#89** Matcher: honest +28 points for career changers; eval runs the production path.
6. **#90** This plan and handoff (docs).
7. **#91** Jobs abroad no longer read as US states ("Amsterdam, NH").
8. **#92** Landing "Free tools" section. Stacked on #88.
9. **#93** Marketing kit: week 1 posts + `scripts/job-drop.ts`. Stacked on #92.
10. **#94** Pay parsing fixes (439 labels); `scripts/backfill-pay.ts` is a dry run until `--apply`.
11. **#95** `/check` social card. Stacked on #87.

Stacks: 87 -> 95, and 87 -> 88 -> 92 -> 93. Merge the base first.

#86 and #87 both add event names in `src/lib/track.ts` next to `feed_pull`: if Git flags a
conflict there, keep both lines.

## Learned

- The quality eval used to skip the keyword brief that production sends, so it showed +3
  points. Use `--keywords fit` (now the default) to measure what users get.
- The feed is thin for non-tech roles once titles are strict (10 real ops coordinator jobs,
  one employer dominating customer service and restaurant manager). The next big lever is a
  non-tech source (Adzuna or more Workday/SmartRecruiters employers by industry).
- Affirm's live Greenhouse ads show an unfilled pay template ("$X - $X"): `/check` reports
  "no pay listed" correctly; our feed has older text.
- "Amsterdam, NH" (Lucid, Netherlands) is read as New Hampshire.
- A guard hook blocks any shell command that mentions the env file, even `cp` to a worktree.
  Worktrees don't need it for build/tests; the dev server there still reached the DB.
- AI spend for the night's real-model checks: about $2.

## Next (from the plan, week 1)

- After merges: watch the first real users in `/admin`; check USAJOBS jobs appear after a match.
- Weekly email to admins, then live. Non-tech job source (Adzuna key from Jake).
