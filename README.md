# ReWork

Tailor your resume to any job in under a minute. Nothing made up.

Upload a resume once, paste a job link, and get a resume and cover letter rewritten for that job. Every rewrite goes through a fact guard that checks numbers, employers, titles, dates, tools and credentials against the original resume; anything unsupported is removed or flagged. Pro adds unlimited tailoring and cover letters, an evidence interview (asks for real numbers instead of guessing), an application tracker, and Word export.

Live at https://rework.hellojakejohn.com. Operated by Jakob Johnson, Saint Paul, MN.

## Stack

- Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Radix UI
- PostgreSQL on Supabase (us-west-2) via Prisma 6.8.2, Supabase Storage for uploaded files
- NextAuth v4 with Google sign-in (database sessions)
- OpenAI API (gpt-4o for parsing, tailoring, cover letters, evidence; gpt-4o-mini for job page extraction)
- Stripe (Pro Monthly subscription, Job Hunt Pass one-time payment, billing portal)
- @react-pdf/renderer for PDFs, docx for Word files
- Vercel hosting, Vercel Analytics, Vercel Cron
- Vitest

## Where things live

| Path | What |
| --- | --- |
| `src/app/page.tsx` | Landing page (server component, no client JS of its own) |
| `src/app/(app)/` | Pages that need a session: `/dashboard`, `/dashboard/tracker`, `/pricing`, `/auth/signin`, `/admin` |
| `src/components/flow/` | The whole app UI: Resume -> Job -> Tailor -> Result cards on `/dashboard` |
| `src/lib/plans.ts` | Every plan limit, daily ceiling, input cap and pricing string |
| `src/lib/track.ts`, `src/lib/ai-usage.ts` | Analytics events and per-call OpenAI token usage |
| `src/lib/daily-ceiling.ts` | Per-user daily ceilings (Pro included) |
| `src/lib/account.ts` | Data export and account deletion |
| `src/lib/admin-analytics.ts` | Funnel, errors, spend and MRR numbers for `/admin` |
| `prisma/schema.prisma`, `prisma/migrations/` | Schema and hand-applied migration SQL |

See `CLAUDE.md` for the full key-files list and `STATE.md` for current status.

## Environment variables

Put these in `.env` (not `.env.local`; Prisma reads `.env`). `npm run build` works with none of them set.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Supabase session pooler, port 5432 |
| `NEXTAUTH_URL` | yes | Deployed origin, e.g. `https://rework.hellojakejohn.com`. Also used for canonical URLs, sitemap and Stripe redirects |
| `NEXTAUTH_SECRET` | yes | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | yes | Google OAuth client |
| `OPENAI_API_KEY` | yes | |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | yes | Storage for uploaded resumes (`resumes` bucket, private) |
| `STRIPE_SECRET_KEY` | for billing | Without it checkout returns 503 |
| `STRIPE_WEBHOOK_SECRET` | for billing | Signing secret of the webhook endpoint |
| `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PASS_30D` | for billing | Price IDs |
| `CRON_SECRET` | yes on Vercel | Authorizes `/api/keepalive` and `/api/cron/expire-entitlements` |
| `ADMIN_EMAILS` | no | Comma separated; defaults to the owner's addresses |
| `OPENAI_PARSE_MODEL`, `OPENAI_TAILOR_MODEL`, `OPENAI_COVER_LETTER_MODEL`, `OPENAI_EVIDENCE_MODEL`, `OPENAI_JOB_MODEL` | no | Model overrides |

`/api/health` (admins only) reports which keys are set and pings the DB and OpenAI.

## Local development

```bash
npm install
npx prisma generate
npm run dev            # http://localhost:3000
```

Migrations are applied by hand in the Supabase SQL editor, in folder order, from `prisma/migrations/*/migration.sql`. Don't run `prisma migrate` against production, and don't upgrade Prisma without talking about it first.

## Scripts

| Command | What |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Unit tests (Vitest), offline, no env needed |
| `npm run eval:tailor` | Runs the real tailor pipeline on `scripts/fixtures/*.json`. Needs `OPENAI_API_KEY`; makes billed calls |
| `npx tsc --noEmit` | Type check |
| `node scripts/generate-og-image.js` | Rebuilds `public/og-image.png` from `public/og-image.svg` |

## Contact

hellojakejohn@gmail.com
