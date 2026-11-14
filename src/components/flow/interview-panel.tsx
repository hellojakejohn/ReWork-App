"use client"

// Result card -> Interview tab. The questions this interviewer is likely to ask, what each
// checks, and which of your own bullets answer it. Gaps are shown as gaps.
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, Copy, MessageCircleQuestion, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FREE_INTERVIEW_PREPS_PER_MONTH } from "@/lib/plans"
import { PREP_QUESTIONS, type StoredInterviewPrep } from "@/lib/interview-prep-shared"
import { buildInterviewPrep, loadPrepQuota, type ApplicationDetailDTO, type Quota } from "./api"
import { ErrorNote } from "./ui"

function prepAsNotes(prep: StoredInterviewPrep, title: string): string {
  const qs = prep.questions.map((q, i) =>
    [`${i + 1}. ${q.question}`, q.why && `   They're checking: ${q.why}`, ...q.bullets.map((b) => `   - ${b}`), q.angle && `   How to answer: ${q.angle}`].filter(Boolean).join("\n")
  )
  const ask = prep.askThem.length ? `\nQuestions to ask them\n${prep.askThem.map((q) => `- ${q}`).join("\n")}` : ""
  return `Interview prep: ${title}\n\n${qs.join("\n\n")}\n${ask}`
}

export function InterviewPanel({
  application,
  onChange,
  onUpgrade,
}: {
  application: ApplicationDetailDTO
  onChange: (application: ApplicationDetailDTO) => void
  onUpgrade: (reason?: string) => void
}) {
  const prep = application.interviewPrep
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [quota, setQuota] = useState<Quota | null>(null)

  useEffect(() => {
    let live = true
    void loadPrepQuota(application.id).then((r) => live && r.ok && setQuota(r.prepQuota))
    return () => {
      live = false
    }
  }, [application.id])

  const build = async () => {
    if (quota?.remaining === 0) {
      onUpgrade(`Free accounts get ${FREE_INTERVIEW_PREPS_PER_MONTH} interview prep a month. Pro preps you for every interview.`)
      return
    }
    setBusy(true)
    setError("")
    const r = await buildInterviewPrep(application.id)
    setBusy(false)
    if (!r.ok) {
      if (r.upgradeRequired) onUpgrade(r.error)
      else setError(r.error)
      return
    }
    onChange({ ...application, interviewPrep: r.interviewPrep })
    setQuota(r.prepQuota)
  }

  const copy = async () => {
    if (!prep) return
    try {
      await navigator.clipboard.writeText(prepAsNotes(prep, [application.jobTitle, application.company].filter(Boolean).join(" at ")))
      toast.success("Copied your prep notes")
    } catch {
      toast.error("Couldn't copy. Select the text and copy it instead.")
    }
  }

  if (!prep) {
    return (
      <div className="space-y-4 text-sm">
        <div className="rounded-card border border-border bg-surface-raised p-5">
          <MessageCircleQuestion className="mb-2 h-5 w-5 text-text" />
          <p className="font-semibold text-text">Got an interview? Prep for this exact job.</p>
          <p className="mt-1 text-text-muted">
            The {PREP_QUESTIONS} questions this interviewer is most likely to ask, what each one is really checking, and which of your own bullets answer it. Where your
            resume has nothing, we say so, so you can prepare an honest answer.
          </p>
          <Button className="mt-4" onClick={() => void build()} loading={busy}>
            {!busy && <Sparkles className="h-4 w-4" />} {busy ? "Preparing" : "Prep me for the interview"}
          </Button>
          {quota?.limit != null && (
            <p className="mt-2 text-xs text-text-muted">
              {quota.remaining} of {quota.limit} free interview prep left this month.
            </p>
          )}
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    )
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-text-muted">Practice these out loud. Your proof is quoted straight from your resume.</p>
        <Button variant="secondary" size="sm" onClick={() => void copy()}>
          <Copy className="h-3.5 w-3.5" /> Copy as notes
        </Button>
        <Button variant="text" size="sm" onClick={() => void build()} loading={busy}>
          {!busy && <RefreshCw className="h-3.5 w-3.5" />} New set
        </Button>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <ol className="space-y-3">
        {prep.questions.map((q, i) => (
          <li key={i} className="rounded-card border border-border p-4">
            <p className="font-semibold text-text">
              {i + 1}. {q.question}
            </p>
            {q.why && <p className="mt-1 text-xs text-text-muted">They&apos;re checking: {q.why}</p>}
            {q.bullets.length > 0 ? (
              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold text-text-muted">Your proof</p>
                <ul className="space-y-1">
                  {q.bullets.map((b) => (
                    <li key={b} className="rounded-md bg-success-tint px-2.5 py-1.5 text-text">
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 flex items-start gap-1.5 rounded-card bg-warn-tint p-2.5 text-xs text-text">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" /> Nothing on your resume answers this one yet. Prepare an honest answer.
              </p>
            )}
            {q.angle && (
              <p className="mt-2 text-text-secondary">
                <span className="font-semibold text-text">How to answer: </span>
                {q.angle}
              </p>
            )}
          </li>
        ))}
      </ol>
      {prep.askThem.length > 0 && (
        <div className="rounded-card border border-border p-4">
          <p className="mb-2 font-semibold text-text">Questions to ask them</p>
          <ul className="list-disc space-y-1 pl-5 text-text-secondary">
            {prep.askThem.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
