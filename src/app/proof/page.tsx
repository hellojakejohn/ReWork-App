import type { Metadata } from "next"
import Link from "next/link"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { getProofStats, type ProofStats } from "@/lib/proof-stats"

// /proof: running totals of every tailor's receipt (docs/token-plan.md idea 2). Counts only:
// no user numbers, no revenue. Stats are recounted at most hourly (src/lib/proof-stats.ts).
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Proof",
  description: "Every resume rework has tailored, counted: what it kept, what it added, what it left out, and what it invented (nothing).",
  alternates: { canonical: "/proof" },
}

const fmt = (n: number) => n.toLocaleString("en-US")

async function loadStats(): Promise<ProofStats | null> {
  try {
    return await getProofStats()
  } catch (error) {
    console.error("[proof] stats failed:", error)
    return null
  }
}

function Stat({ label, value, note, tone = "text" }: { label: string; value: string; note: string; tone?: "text" | "success" | "accent" }) {
  const color = tone === "success" ? "text-success" : tone === "accent" ? "text-accent-strong" : "text-text"
  return (
    <div className="rounded-card bg-surface p-6">
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className={`mt-1 font-serif text-4xl font-semibold tabular-nums ${color}`}>{value}</dd>
      <p className="mt-2 text-sm leading-relaxed">{note}</p>
    </div>
  )
}

export default async function ProofPage() {
  const stats = await loadStats()

  return (
    <div className="min-h-screen bg-bg text-text-secondary">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-serif text-4xl font-medium tracking-tight text-text sm:text-5xl">Invented: 0</h1>
        <p className="mt-4 max-w-2xl leading-relaxed">
          Every resume rework tailors comes with a receipt: what it kept, what it added, and what it left out because your resume
          doesn&apos;t back it up. These are the receipts added together.
        </p>

        {stats ? (
          <>
            <dl className="mt-8 grid gap-4 sm:grid-cols-2">
              <Stat label="Resumes tailored" value={fmt(stats.tailors)} note="Every tailor run, re-tailors included." />
              <Stat
                label="Invented"
                value="0"
                tone="success"
                note="Always zero. Anything your resume doesn't support is taken out before you see the result."
              />
              <Stat label="Improvements kept" value={fmt(stats.kept)} note="Rewritten bullets people kept in their tailored resume." />
              <Stat label="Job keywords added" value={fmt(stats.keywordsAdded)} note="Words from the job post that the resume now covers, from experience it already had." />
              <Stat
                label="Claims left out"
                value={fmt(stats.leftOut)}
                tone="accent"
                note="Numbers and claims the AI tried to add that weren't in the resume. We asked the person instead."
              />
              {stats.match && (
                <Stat
                  label="Average job match"
                  value={`${stats.match.before}% → ${stats.match.after}%`}
                  note="Share of the job's keywords the resume covers, before and after tailoring."
                />
              )}
            </dl>
            <p className="mt-6 text-sm">Updated hourly. Counts come from saved results; a deleted account&apos;s results stop counting, except in the tailor total.</p>
          </>
        ) : (
          <p className="mt-8 rounded-card bg-surface p-6">The numbers didn&apos;t load just now. Try again in a minute.</p>
        )}

        <Link
          href="/dashboard"
          className="mt-10 inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg hover:bg-accent-hover"
        >
          Tailor my resume, free
        </Link>
      </main>
      <SiteFooter />
    </div>
  )
}
