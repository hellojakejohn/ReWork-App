# ReWork - Claude Code Instructions

## First Steps for Any New Session
1. Read docs/PROJECT.md (scope, monetization, roadmap, settled decisions, how we work), then
   STATE.md (current technical truth and its "Next session" list)
2. Run `npm run dev` to verify the app boots
3. Ask what we're working on today

## Project Structure
- `src/app/` - Next.js app router pages + API routes (`(app)/` route group = pages that need a session)
- `src/components/` - React components
- `src/lib/` - Utilities (storage.ts, prisma.ts, input.ts); `src/lib/ai/` is the model provider layer
- `src/types/` - TypeScript definitions
- `prisma/` - Database schema

## Key Files
- `src/components/flow/` - the whole app UI: one page at `/dashboard` (Resume -> Job -> Tailor -> Result cards). New features go inside these cards, not new multi-step pages.
- `src/lib/parse-resume.ts` + `src/lib/parse-validate.ts` - resume parsing (PDF file input + text, strict schema) and the "is it in the file?" validator. No fallback parser.
- `src/lib/master-resume.ts` - parsed shape <-> Resume row structured fields
- `src/lib/tailor.ts`, `src/lib/fact-guard.ts`, `src/lib/tailor-changes.ts` - tailoring, fact checks, per-bullet accept/revert
- `src/lib/job-resolve/` - job URL resolver chain (ATS APIs -> JSON-LD -> page + model -> needsPaste)
- `src/lib/resume-pdf.tsx` - Classic/Modern PDF templates (resume + cover letter)
- `src/app/globals.css` - brand color tokens (light on `:root`, dark on `.dark`); `tailwind.config.ts` maps every color onto them. No raw palette classes (`slate-`, `emerald-`...)
- `src/lib/theme.ts` + `src/components/theme-toggle.tsx` - Light/Dark/System (localStorage, inline no-flash script in `layout.tsx`)
- `src/components/ui/button.tsx` - the only button (primary/inverse/secondary/text); `src/components/ui/logo.tsx` - the wordmark (`public/brand/`)
- `src/lib/receipt.ts` + `src/components/flow/receipt.tsx` - the Result card's "Your receipt" and left-out claims (counts from the tailor report, never hardcoded)
- `src/lib/resume-docx.ts` - Word export (Classic structure, ATS-safe: no tables/text boxes)
- `src/lib/cover-letter.ts` + `src/lib/text-facts.ts` - cover letters and the prose fact guard
- `src/lib/evidence.ts` - evidence interview (questions, answer-only rewrites, apply to master)
- `src/lib/skill-check.ts` + `src/components/flow/skill-check.tsx` - free fit check and skill check (job keywords, answers placed from the user's note only, `guardAddition`, apply to master)
- `src/lib/job-checks.ts` - job title cleanup, "this ad is about another company" and job-scam warnings (`scamSignals`, no AI)
- `src/lib/tracker.ts` + `src/components/tracker/` - application tracker at `/dashboard/tracker`
- `src/lib/plans.ts` - every plan limit and all pricing copy; `src/lib/tailor-quota.ts` meters tailors and cover letters
- `src/lib/storage.ts` - Supabase Storage (was S3)
- `src/lib/track.ts` + `src/lib/ai-usage.ts` - analytics events and per-call AI token usage; `src/lib/admin-analytics.ts` feeds `/admin`
- `src/lib/daily-ceiling.ts` - per-user daily ceilings (Pro included), counted from events
- `src/lib/ai-cap.ts` + `src/lib/ai-inflight.ts` - AI cap, kill switch, global daily ceiling, per-user in-flight limit
- `src/lib/token-burn.ts` + `src/components/token/` - burn $REWORK for 30 days of Pro (off unless `REWORK_MINT` is set; own `AI_BURN_DAILY_USD` ceiling)
- `src/instrumentation.ts` - server errors to `events` (shown in `/admin`)
- `docs/PROJECT.md` - the whole project on one page; `docs/launch-audit.md`, `docs/token-plan.md` - launch go/no-go and the token plan
- `scripts/eval-models.ts` - real-model quality eval (private resumes in `scripts/fixtures/private/`, output in `eval-results/`, both gitignored)
- `src/lib/save-job-script.ts` + `src/lib/saved-job.ts` + `src/app/save/` - Save to ReWork (LinkedIn/Indeed read in the user's browser); `extension/` is the Chrome extension
- `src/lib/account.ts` - Download my data / Delete my account (Stripe cancel first)
- `src/app/page.tsx` + `src/components/site/` - landing, legal pages, public header/footer (no auth JS); session pages live in `src/app/(app)/`
- `prisma/schema.prisma` - Database schema

## Environment
- `.env` file (not .env.local) - Prisma reads from .env
- Supabase region: us-west-2
- Database: Session pooler connection (port 5432)

## Rules
- No em-dashes anywhere (code, comments, copy, docs). Concise, phone-sized replies
- New branch, small commits, PR at the end; never push to main. Jake merges PRs himself
- Ask before any spend, prod env change, merge, or DB migration (migrations are pasted by hand
  in the Supabase SQL editor; never `prisma migrate deploy`)
- Don't reopen settled decisions (docs/PROJECT.md lists them)
- Secrets never go through chat; Jake pastes them into Vercel or the local env file
- A local guard hook blocks shell commands whose text mentions the Vercel CLI, the env file or
  recursive deletes (commit messages included). Don't work around it: hand Jake the command
- `npm run eval:models` makes real billed calls: ask for a budget first
- Always test changes after making them
- Don't upgrade Prisma without explicit permission
- Don't run `npm audit fix --force` without explicit permission
- Make changes in small, testable chunks
- If something breaks, fix it before moving on