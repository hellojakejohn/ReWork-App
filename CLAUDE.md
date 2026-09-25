# ReWork - Claude Code Instructions

## First Steps for Any New Session
1. Read STATE.md for current project status
2. Read TODO.md for prioritized task list
3. Run `npm run dev` to verify the app boots
4. Ask what we're working on today

## Project Structure
- `src/app/` - Next.js app router pages + API routes (`(app)/` route group = pages that need a session)
- `src/components/` - React components
- `src/lib/` - Utilities (storage.ts, openai.ts, prisma.ts)
- `src/types/` - TypeScript definitions
- `prisma/` - Database schema

## Key Files
- `src/components/flow/` - the whole app UI: one page at `/dashboard` (Resume -> Job -> Tailor -> Result cards). New features go inside these cards, not new multi-step pages.
- `src/lib/parse-resume.ts` + `src/lib/parse-validate.ts` - resume parsing (PDF file input + text, strict schema) and the "is it in the file?" validator. No fallback parser.
- `src/lib/master-resume.ts` - parsed shape <-> Resume row structured fields
- `src/lib/tailor.ts`, `src/lib/fact-guard.ts`, `src/lib/tailor-changes.ts` - tailoring, fact checks, per-bullet accept/revert
- `src/lib/job-resolve/` - job URL resolver chain (ATS APIs -> JSON-LD -> page + model -> needsPaste)
- `src/lib/resume-pdf.tsx` - Classic/Modern PDF templates (resume + cover letter)
- `src/lib/resume-docx.ts` - Word export (Classic structure, ATS-safe: no tables/text boxes)
- `src/lib/cover-letter.ts` + `src/lib/text-facts.ts` - cover letters and the prose fact guard
- `src/lib/evidence.ts` - evidence interview (questions, answer-only rewrites, apply to master)
- `src/lib/tracker.ts` + `src/components/tracker/` - application tracker at `/dashboard/tracker`
- `src/lib/plans.ts` - every plan limit and all pricing copy; `src/lib/tailor-quota.ts` meters tailors and cover letters
- `src/lib/storage.ts` - Supabase Storage (was S3)
- `src/lib/track.ts` + `src/lib/ai-usage.ts` - analytics events and per-call OpenAI token usage; `src/lib/admin-analytics.ts` feeds `/admin`
- `src/lib/daily-ceiling.ts` - per-user daily ceilings (Pro included), counted from events
- `src/lib/account.ts` - Download my data / Delete my account (Stripe cancel first)
- `src/app/page.tsx` + `src/components/site/` - landing, legal pages, public header/footer (no auth JS); session pages live in `src/app/(app)/`
- `prisma/schema.prisma` - Database schema

## Environment
- `.env` file (not .env.local) - Prisma reads from .env
- Supabase region: us-west-2
- Database: Session pooler connection (port 5432)

## Rules
- Always test changes after making them
- Don't upgrade Prisma without explicit permission
- Don't run `npm audit fix --force` without explicit permission
- Make changes in small, testable chunks
- If something breaks, fix it before moving on