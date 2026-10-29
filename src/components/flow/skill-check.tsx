"use client"

// Fit check + skill check, inside the Tailor card. The fit check scores the resume against
// the job's keywords before a tailor is spent. The skill check asks about each missing
// keyword (No / A little / Yes, plus where or how) and adds the user's own answers to the
// master, so the tailor that follows can use them. Free for everyone.
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { Check, ListChecks, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { LOW_FIT_SCORE, MAX_SKILL_NOTE, MAX_SKILL_QUESTIONS, type FitCoverage, type SkillAddition, type SkillAnswer, type SkillLevel } from "@/lib/skill-check-shared"
import { applySkillAnswers, checkFit, placeSkillAnswers, type JobDraft, type MasterResumeDTO } from "./api"
import { ErrorNote, inputClass } from "./ui"

export interface Fit {
  keywords: string[]
  coverage: FitCoverage
}

// One fit check per resume + job for the session: going Back and forward doesn't re-ask.
const fitCache = new Map<string, Fit>()
const fitKey = (master: MasterResumeDTO, job: JobDraft) => `${master.id}\n${job.title}\n${job.company}\n${job.description}`

/** The fit for this resume and job, fetched once when `enabled`. */
export function useFit(master: MasterResumeDTO | null, job: JobDraft | null, enabled: boolean) {
  const key = master && job ? fitKey(master, job) : ""
  const [fit, setFit] = useState<Fit | null>(() => (key ? fitCache.get(key) ?? null : null))
  const [state, setState] = useState<"idle" | "loading" | "error">("idle")

  useEffect(() => {
    if (!key) {
      setFit(null)
      return
    }
    const cached = fitCache.get(key)
    setFit(cached ?? null)
    if (cached || !enabled || !master || !job) return
    let cancelled = false
    setState("loading")
    void checkFit(master.id, job).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setState("error")
        return
      }
      const next = { keywords: result.keywords, coverage: result.coverage }
      fitCache.set(key, next)
      setFit(next)
      setState("idle")
    })
    return () => {
      cancelled = true
    }
    // master and job are captured by key; refetch only when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  const update = (coverage: FitCoverage) => {
    if (!fit || !key) return
    const next = { ...fit, coverage }
    fitCache.set(key, next)
    setFit(next)
  }
  return { fit, loading: state === "loading", failed: state === "error", update }
}

export function FitSummary({ fit, loading, failed, onCheck }: { fit: Fit | null; loading: boolean; failed: boolean; onCheck: () => void }) {
  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-text-muted" aria-live="polite">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking how well your resume fits this job...
      </p>
    )
  }
  if (failed || !fit || fit.keywords.length === 0) return null
  const { score, present, missing } = fit.coverage
  const low = score < LOW_FIT_SCORE
  return (
    <div className="space-y-3 rounded-card border border-border bg-surface-raised p-4" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-text">Fit check</p>
        <p className={cn("text-sm font-semibold", low ? "text-warn" : "text-success")}>{score}%</p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
        <div className={cn("h-full rounded-full", low ? "bg-warn" : "bg-success")} style={{ width: `${Math.max(score, 3)}%` }} />
      </div>
      <p className="text-sm text-text-secondary">
        Your resume shows {present.length} of the {fit.keywords.length} things this job asks for.
        {low && missing.length > 0 && " As it stands, this job is a stretch."}
      </p>
      {missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={onCheck}>
            <ListChecks className="h-4 w-4" /> Have you done any of these?
          </Button>
          <span className="text-xs text-text-muted">People forget things: a class, a side project. Free.</span>
        </div>
      )}
    </div>
  )
}

const LEVELS: { value: SkillLevel; label: string }[] = [
  { value: "no", label: "No" },
  { value: "some", label: "A little" },
  { value: "yes", label: "Yes" },
]

type Phase = "asking" | "placing" | "review" | "saving"

export function SkillCheck({
  master,
  fit,
  onClose,
  onSaved,
}: {
  master: MasterResumeDTO
  fit: Fit
  onClose: () => void
  onSaved: (master: MasterResumeDTO, coverage: FitCoverage, applied: number) => void
}) {
  const missing = fit.coverage.missing.slice(0, MAX_SKILL_QUESTIONS)
  const [phase, setPhase] = useState<Phase>("asking")
  const [answers, setAnswers] = useState<Record<string, SkillAnswer>>({})
  const [additions, setAdditions] = useState<SkillAddition[]>([])
  const [keep, setKeep] = useState<Record<string, boolean>>({})
  const [error, setError] = useState("")

  const given = missing.map((k) => answers[k]).filter((a): a is SkillAnswer => !!a && a.level !== "no")
  const setAnswer = (keyword: string, patch: Partial<SkillAnswer>) =>
    setAnswers((all) => ({ ...all, [keyword]: { ...(all[keyword] ?? { keyword, level: "no" as SkillLevel, note: "" }), ...patch } }))

  const place = async () => {
    setError("")
    setPhase("placing")
    const result = await placeSkillAnswers(master.id, fit.keywords, given)
    if (!result.ok) {
      setError(result.error)
      setPhase("asking")
      return
    }
    setAdditions(result.additions)
    setKeep(Object.fromEntries(result.additions.map((a) => [a.keyword, true])))
    setPhase("review")
  }

  const save = async () => {
    setError("")
    setPhase("saving")
    const accepted = additions.filter((a) => keep[a.keyword])
    const result = await applySkillAnswers(master.id, fit.keywords, given, accepted)
    if (!result.ok) {
      setError(result.error)
      setPhase("review")
      return
    }
    onSaved(result.master, result.coverage, result.applied)
  }

  const chosen = additions.filter((a) => keep[a.keyword]).length
  return (
    <div className="space-y-4">
      {phase === "asking" || phase === "placing" ? (
        <>
          <div>
            <p className="font-medium text-text">Have you done any of these?</p>
            <p className="text-sm text-text-muted">
              This job asks for them and your resume doesn&apos;t show them. Only say yes if it&apos;s true: we add exactly what you tell us, nothing more.
            </p>
          </div>
          <ul className="space-y-2">
            {missing.map((keyword, i) => {
              const a = answers[keyword]
              const level = a?.level ?? "no"
              return (
                <li key={keyword} className="rounded-card border border-border bg-surface-raised p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-text">{keyword}</span>
                    <div role="radiogroup" aria-label={`Have you done ${keyword}?`} className="flex rounded-full border border-border p-0.5">
                      {LEVELS.map((l) => (
                        <button
                          key={l.value}
                          type="button"
                          role="radio"
                          aria-checked={level === l.value}
                          disabled={phase === "placing"}
                          onClick={() => setAnswer(keyword, { level: l.value })}
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                            level === l.value ? "bg-text text-surface" : "text-text-secondary hover:text-text"
                          )}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {level !== "no" && (
                    <input
                      className={`${inputClass} mt-2`}
                      value={a?.note ?? ""}
                      maxLength={MAX_SKILL_NOTE}
                      disabled={phase === "placing"}
                      autoFocus
                      aria-label={`Where or how did you use ${keyword}? (optional)`}
                      placeholder={i === 0 ? `Where or how? e.g. "took a 3-hour ${keyword} class at school" (optional)` : "Where or how? (optional)"}
                      onChange={(e) => setAnswer(keyword, { note: e.target.value })}
                    />
                  )}
                </li>
              )
            })}
          </ul>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex items-center justify-end gap-2">
            <Button variant="text" onClick={onClose} disabled={phase === "placing"}>
              Cancel
            </Button>
            <Button loading={phase === "placing"} disabled={given.length === 0} onClick={() => void place()}>
              Next{given.length > 0 ? ` (${given.length})` : ""}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div>
            <p className="font-medium text-text">Here&apos;s where they&apos;d go</p>
            <p className="text-sm text-text-muted">Built only from your answers. Untick anything you don&apos;t want. This updates your main resume.</p>
          </div>
          <ul className="space-y-2">
            {additions.map((a) => (
              <li key={a.keyword}>
                <label className="flex cursor-pointer items-start gap-3 rounded-card border border-border bg-surface-raised p-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-accent"
                    checked={!!keep[a.keyword]}
                    disabled={phase === "saving"}
                    onChange={(e) => setKeep((k) => ({ ...k, [a.keyword]: e.target.checked }))}
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium uppercase tracking-wide text-text-muted">{a.targetLabel}</span>
                    <span className="block text-sm text-text">{a.text}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex items-center justify-end gap-2">
            <Button variant="text" onClick={() => setPhase("asking")} disabled={phase === "saving"}>
              Back
            </Button>
            <Button loading={phase === "saving"} disabled={chosen === 0} onClick={() => void save()}>
              <Check className="h-4 w-4" /> Add {chosen} to my resume
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
