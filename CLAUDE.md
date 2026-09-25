# ReWork - Claude Code Instructions

## First Steps for Any New Session
1. Read STATE.md for current project status
2. Read TODO.md for prioritized task list
3. Run `npm run dev` to verify the app boots
4. Ask what we're working on today

## Project Structure
- `src/app/` - Next.js app router pages + API routes
- `src/components/` - React components
- `src/lib/` - Utilities (storage.ts, openai.ts, prisma.ts)
- `src/types/` - TypeScript definitions
- `prisma/` - Database schema

## Key Files
- `src/components/flow/` - the whole app UI: one page at `/dashboard` (Resume -> Job -> Tailor -> Result cards)
- `src/lib/parse-resume.ts` + `src/lib/parse-validate.ts` - resume parsing (PDF file input + text, strict schema) and the "is it in the file?" validator. No fallback parser.
- `src/lib/master-resume.ts` - parsed shape <-> Resume row structured fields
- `src/lib/tailor.ts`, `src/lib/fact-guard.ts`, `src/lib/tailor-changes.ts` - tailoring, fact checks, per-bullet accept/revert
- `src/lib/job-resolve/` - job URL resolver chain (ATS APIs -> JSON-LD -> page + model -> needsPaste)
- `src/lib/resume-pdf.tsx` - Classic/Modern PDF templates
- `src/lib/storage.ts` - Supabase Storage (was S3)
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