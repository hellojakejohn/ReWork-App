"use client"

// The public fit check, tailor-themed: two "pattern pieces" (your resume, the job) with
// stitched edges, a tape measure for the score, and three piles: fits, fits in other words,
// needs alterations. Posts to /api/fit; nothing is stored.
import { useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, FileText, Ruler, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FREE_TAILORS_PER_MONTH } from "@/lib/plans"
import { PILES, VERDICT_WORDS, type FitVerdict } from "@/lib/fit-words"
import { Stitching, TapeMeasure, stitchedEdge } from "@/components/ui/tailor"

interface FitResult {
  score: number
  verdict: FitVerdict
  present: string[]
  related: string[]
  missing: string[]
}

const piece = `relative rounded-panel ${stitchedEdge} bg-surface p-5 sm:p-6`

export function FitCheck() {
  const [job, setJob] = useState("")
  const [resumeText, setResumeText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<FitResult | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const ready = job.trim().length >= 200 && (!!file || resumeText.trim().length >= 200)

  const measure = async () => {
    setBusy(true)
    setError("")
    setResult(null)
    const body = new FormData()
    body.set("job", job)
    if (file) body.set("file", file)
    else body.set("resumeText", resumeText)
    try {
      const res = await fetch("/api/fit", { method: "POST", body })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        setError(data?.error ?? "Something went wrong. Please try again.")
        return
      }
      setResult(data as FitResult)
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
    } catch {
      setError("Couldn't reach ReWork. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-10">
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={piece} aria-labelledby="fit-resume">
          <PieceLabel n={1} id="fit-resume" title="Your resume" hint="A PDF or Word file, or paste the text." />
          {file ? (
            <div className="mt-4 flex items-center gap-3 rounded-input border border-border bg-bg px-4 py-3">
              <FileText className="h-5 w-5 text-text-muted" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm text-text">{file.name}</span>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="rounded-full p-1 text-text-muted hover:bg-surface-raised hover:text-text"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-input border border-border bg-bg px-4 py-3 text-sm font-semibold text-text hover:border-text-muted"
              >
                <Upload className="h-4 w-4" /> Upload PDF or Word
              </button>
              <p className="my-2 text-center text-xs text-text-muted">or</p>
              <Textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste your resume text..."
                className="min-h-[140px] bg-bg"
                aria-label="Resume text"
              />
            </>
          )}
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              const picked = e.target.files?.[0]
              if (picked) setFile(picked)
              e.target.value = ""
            }}
          />
        </section>
        <section className={piece} aria-labelledby="fit-job">
          <PieceLabel n={2} id="fit-job" title="The job" hint="Paste the whole post: duties and requirements." />
          <Textarea
            value={job}
            onChange={(e) => setJob(e.target.value)}
            placeholder="Paste the job description here..."
            className="mt-4 min-h-[220px] bg-bg"
            aria-label="Job description"
          />
        </section>

      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button size="lg" onClick={() => void measure()} disabled={!ready || busy} loading={busy}>
          <Ruler className="h-5 w-5" /> {busy ? "Measuring..." : "Measure the fit"}
        </Button>
        <p className="text-sm text-text-muted">Nothing you add here is saved.</p>
      </div>
      {busy && <Stitching label="Reading the job post..." className="mt-5" />}
      {error && <p className="mt-4 rounded-card bg-removed px-4 py-3 text-sm text-text">{error}</p>}

      {result && (
        <div ref={resultRef} className="mt-12 scroll-mt-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
          <Result result={result} />
        </div>
      )}
    </div>
  )
}

function PieceLabel({ n, id, title, hint }: { n: number; id: string; title: string; hint: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage text-sm font-bold text-text">{n}</span>
      <div>
        <h2 id={id} className="text-lg font-bold text-text">
          {title}
        </h2>
        <p className="text-sm text-text-muted">{hint}</p>
      </div>
    </div>
  )
}

function Result({ result }: { result: FitResult }) {
  const v = VERDICT_WORDS[result.verdict]
  return (
    <section aria-labelledby="fit-result" className="rounded-panel bg-surface p-6 shadow-float sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-text-muted">Your fit</p>
          <p id="fit-result" className="font-serif text-6xl font-medium tabular-nums text-text">
            {result.score}%
          </p>
        </div>
        <div className="max-w-md">
          <p className="font-serif text-2xl font-semibold text-text">{v.title}</p>
          <p className="mt-1 text-sm text-text-secondary">{v.body}</p>
        </div>
      </div>

      <TapeMeasure value={result.score} className="mt-8" />

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <Pile {...PILES.present} words={result.present} chip="bg-sage text-text" />
        <Pile
          {...PILES.related}
          words={result.related}
          chip="border border-dotted border-text/40 text-text"
        />
        <Pile
          {...PILES.missing}
          words={result.missing}
          chip="border border-dashed border-accent/60 text-text"
        />
      </div>

      <div className="mt-8 flex flex-col gap-4 rounded-card bg-inverse p-6 text-inverse-fg sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-serif text-2xl font-semibold">Have it tailored.</p>
          <p className="mt-1 text-sm opacity-80">
            Your resume, taken in to fit this job, from your real experience only. {FREE_TAILORS_PER_MONTH} free a month, no card.
          </p>
        </div>
        <Button asChild size="lg" variant="secondary" className="shrink-0">
          <Link href="/auth/signin?callbackUrl=%2Fdashboard">
            Tailor my resume <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  )
}

function Pile({ title, hint, words, chip }: { title: string; hint: string; words: string[]; chip: string }) {
  return (
    <div>
      <h3 className="font-bold text-text">
        {title} <span className="font-normal text-text-muted">({words.length})</span>
      </h3>
      <p className="mt-0.5 text-xs text-text-muted">{hint}</p>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {words.length === 0 && <li className="text-sm text-text-muted">None</li>}
        {words.map((w) => (
          <li key={w} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${chip}`}>
            {w}
          </li>
        ))}
      </ul>
    </div>
  )
}
