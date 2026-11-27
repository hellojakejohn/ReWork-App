"use client"

// The /check form and result: what we noticed (scam signs first), what looked fine, and
// whether the job is still on the employer's own board. Posts to /api/check.
import { useRef, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, CheckCircle2, Ghost, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FREE_TAILORS_PER_MONTH } from "@/lib/plans"
import { SCAM_SAFETY_TIP } from "@/lib/job-checks"
import { LeadCard } from "@/components/site/lead-card"

interface Signal {
  id: string
  label: string
  quote?: string
}
interface CheckResult {
  job: { title: string; company: string; location: string }
  scam: Signal[]
  ghost: Signal[]
  fine: string[]
  board: { known: boolean; open: boolean; firstSeenAt: string | null; closedAt: string | null; companyOpenJobs: number } | null
  fromLink: boolean
}

function summary(r: CheckResult): { title: string; tone: "bad" | "warn" | "good" } {
  if (r.scam.length > 0) return { title: `${r.scam.length} scam sign${r.scam.length === 1 ? "" : "s"}. Be careful with this one.`, tone: "bad" }
  if (r.board && !r.board.open) return { title: "This job is off the employer's own board.", tone: "warn" }
  if (r.ghost.length >= 2) return { title: `${r.ghost.length} ghost-job signs. Worth a closer look before you apply.`, tone: "warn" }
  if (r.ghost.length === 1) return { title: "One thing to know before you apply.", tone: "warn" }
  return { title: "Nothing stood out. Looks like a real opening.", tone: "good" }
}

export function JobCheck() {
  const [job, setJob] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<CheckResult | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const run = async () => {
    setBusy(true)
    setError("")
    setResult(null)
    try {
      const res = await fetch("/api/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ job }) })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        setError(data?.error ?? "Something went wrong. Please try again.")
        return
      }
      setResult(data.result)
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
    } catch {
      setError("Couldn't reach ReWork. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  const s = result ? summary(result) : null
  const toneClass = s?.tone === "bad" ? "bg-removed" : s?.tone === "warn" ? "bg-warn-tint" : "bg-success-tint"

  return (
    <div className="mt-10">
      <label htmlFor="job-check-input" className="font-semibold text-text">
        The job link, or the whole post
      </label>
      <Textarea
        id="job-check-input"
        value={job}
        onChange={(e) => setJob(e.target.value)}
        placeholder="https://boards.greenhouse.io/... or paste the job post"
        className="mt-2 min-h-[140px] bg-surface"
      />
      <p className="mt-2 text-xs text-text-muted">LinkedIn and Indeed links can&apos;t be opened from our server: paste the post&apos;s text instead.</p>
      <div className="mt-4">
        <Button size="lg" onClick={() => void run()} disabled={job.trim().length < 8 || busy} loading={busy}>
          <Search className="h-4 w-4" /> Check this job
        </Button>
      </div>
      {error && (
        <p className="mt-4 rounded-card bg-removed px-4 py-3 text-sm text-text" role="alert">
          {error}
        </p>
      )}

      {result && s && (
        <section ref={resultRef} className="mt-10 scroll-mt-24" aria-live="polite">
          <div className={`rounded-card ${toneClass} p-5`}>
            <p className="text-sm text-text-muted">
              {result.job.title}
              {result.job.company ? ` at ${result.job.company}` : ""}
              {result.job.location ? `, ${result.job.location}` : ""}
            </p>
            <p className="mt-1 font-serif text-2xl font-semibold text-text">{s.title}</p>
          </div>

          {result.scam.length > 0 && (
            <div className="mt-6">
              <h2 className="flex items-center gap-2 font-bold text-text">
                <AlertTriangle className="h-4 w-4 text-accent" /> Scam signs
              </h2>
              <ul className="mt-2 space-y-3">
                {result.scam.map((x) => (
                  <li key={x.id} className="rounded-card border border-border bg-surface p-4 text-sm text-text">
                    {x.label}
                    {x.quote && <q className="mt-1 block text-text-muted">{x.quote}</q>}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-text-secondary">{SCAM_SAFETY_TIP}</p>
            </div>
          )}

          {result.ghost.length > 0 && (
            <div className="mt-6">
              <h2 className="flex items-center gap-2 font-bold text-text">
                <Ghost className="h-4 w-4 text-text-muted" /> Ghost-job signs
              </h2>
              <ul className="mt-2 space-y-2">
                {result.ghost.map((x) => (
                  <li key={x.id} className="rounded-card border border-border bg-surface p-4 text-sm text-text">
                    {x.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.fine.length > 0 && (
            <div className="mt-6">
              <h2 className="flex items-center gap-2 font-bold text-text">
                <CheckCircle2 className="h-4 w-4 text-success" /> Looked fine
              </h2>
              <ul className="mt-2 space-y-1.5 text-sm text-text-secondary">
                {result.fine.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {result.board?.open && result.board.companyOpenJobs > 1 && (
                <p className="mt-2 text-sm text-text-secondary">
                  {result.job.company || "This employer"} has {result.board.companyOpenJobs.toLocaleString("en-US")} open jobs on its board right now.
                </p>
              )}
            </div>
          )}

          <p className="mt-6 text-xs text-text-muted">Facts, not a verdict. A clean result isn&apos;t a promise; when in doubt, find the role on the company&apos;s own careers page.</p>

          <div className="mt-8 flex flex-col gap-4 rounded-card bg-inverse p-6 text-inverse-fg sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-serif text-2xl font-semibold">{s.tone === "bad" ? "Find real jobs that fit you." : "Applying? Tailor your resume first."}</p>
              <p className="mt-1 text-sm opacity-80">
                {s.tone === "bad"
                  ? "ReWork shows open jobs from employers' own boards, matched to your resume."
                  : `Your resume, fitted to this job from your real experience only. ${FREE_TAILORS_PER_MONTH} free a month, no card.`}
              </p>
            </div>
            <Button asChild size="lg" variant="secondary" className="shrink-0">
              <Link href="/auth/signin?callbackUrl=%2Fdashboard">
                {s.tone === "bad" ? "See my matches" : "Tailor my resume"} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <LeadCard source="check" className="mt-6" />
        </section>
      )}
    </div>
  )
}
