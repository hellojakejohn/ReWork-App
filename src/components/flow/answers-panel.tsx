"use client"

// Result card -> Questions tab. Paste an application question ("Why do you want to work
// here?"), get an answer built only from your resume, then edit, copy or delete it.
// Answers are saved on the application, newest first.
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, Check, Copy, PenLine, ShieldCheck, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ANSWER_LENGTHS, COMMON_QUESTIONS, MAX_QUESTION_CHARS, type AnswerLength, type StoredAnswer } from "@/lib/app-answers-shared"
import { FREE_ANSWERS_PER_MONTH } from "@/lib/plans"
import { deleteAnswer, loadAnswersQuota, saveAnswer, writeAnswer, type ApplicationDetailDTO, type Quota } from "./api"
import { ErrorNote, inputClass } from "./ui"

export function AnswersPanel({
  application,
  onChange,
  onUpgrade,
}: {
  application: ApplicationDetailDTO
  onChange: (application: ApplicationDetailDTO) => void
  onUpgrade: (reason?: string) => void
}) {
  const [question, setQuestion] = useState("")
  const [length, setLength] = useState<AnswerLength>("medium")
  const [writing, setWriting] = useState(false)
  const [error, setError] = useState("")
  const [quota, setQuota] = useState<Quota | null>(null)

  useEffect(() => {
    let live = true
    void loadAnswersQuota(application.id).then((r) => live && r.ok && setQuota(r.answersQuota))
    return () => {
      live = false
    }
  }, [application.id])

  const setAnswers = (answers: StoredAnswer[]) => onChange({ ...application, answers })
  const outOfFree = quota?.remaining === 0

  const write = async () => {
    if (outOfFree) {
      onUpgrade(`Free accounts get ${FREE_ANSWERS_PER_MONTH} application answers a month. Pro answers every question.`)
      return
    }
    setWriting(true)
    setError("")
    const r = await writeAnswer(application.id, question.trim(), length)
    setWriting(false)
    if (!r.ok) {
      if (r.upgradeRequired) onUpgrade(r.error)
      else setError(r.error)
      return
    }
    setAnswers(r.answers)
    setQuota(r.answersQuota)
    setQuestion("")
  }

  return (
    <div className="space-y-5 text-sm">
      <div className="space-y-3">
        <p className="text-text-muted">
          Paste a question from the application. The answer uses only what&apos;s in your resume, fact-checked like your cover letter.
        </p>
        <textarea
          value={question}
          maxLength={MAX_QUESTION_CHARS}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Why do you want to work at this company?"
          aria-label="Application question"
          className={`${inputClass} min-h-[80px]`}
        />
        {!question && (
          <div className="flex flex-wrap gap-1.5">
            {COMMON_QUESTIONS.map((q) => (
              <button key={q} onClick={() => setQuestion(q)} className="rounded-full bg-surface-raised px-2.5 py-1 text-xs text-text-secondary hover:text-text">
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Length" value={length} onChange={setLength} options={ANSWER_LENGTHS.map((l) => ({ id: l.id, label: l.label }))} className="w-full sm:w-64" />
          <Button onClick={() => void write()} loading={writing} disabled={question.trim().length < 5} className="sm:ml-auto">
            {!writing && <Sparkles className="h-4 w-4" />} {writing ? "Writing" : "Write answer"}
          </Button>
        </div>
        {quota?.limit != null && (
          <p className="text-xs text-text-muted">
            {quota.remaining} of {quota.limit} free answers left this month.
          </p>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>

      {application.answers.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-4 text-text-muted">Your answers for this job will be saved here.</p>
      ) : (
        <div className="space-y-3">
          {application.answers.map((a) => (
            <AnswerCard key={a.id} applicationId={application.id} answer={a} onAnswers={setAnswers} />
          ))}
        </div>
      )}
    </div>
  )
}

function AnswerCard({ applicationId, answer, onAnswers }: { applicationId: string; answer: StoredAnswer; onAnswers: (answers: StoredAnswer[]) => void }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(answer.answer)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => setText(answer.answer), [answer.answer])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(answer.answer)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Couldn't copy. Select the text and copy it instead.")
    }
  }

  const save = async () => {
    if (text.trim() === answer.answer) return setEditing(false)
    setBusy(true)
    const r = await saveAnswer(applicationId, answer.id, text.trim())
    setBusy(false)
    if (!r.ok) return toast.error(r.error)
    onAnswers(r.answers)
    setEditing(false)
  }

  const remove = async () => {
    setBusy(true)
    const r = await deleteAnswer(applicationId, answer.id)
    setBusy(false)
    if (!r.ok) return toast.error(r.error)
    onAnswers(r.answers)
  }

  const removed = answer.warnings.filter((w) => w.type === "unsupported_fact" || w.type === "banned_phrase")

  return (
    <div className="rounded-card border border-border p-4">
      <p className="mb-2 font-semibold text-text">{answer.question}</p>
      {editing ? (
        <textarea value={text} onChange={(e) => setText(e.target.value)} aria-label="Edit answer" className={`${inputClass} min-h-[140px] leading-relaxed`} autoFocus />
      ) : (
        <p className="whitespace-pre-line leading-relaxed text-text-secondary">{answer.answer}</p>
      )}
      {answer.needsYou && (
        <p className="mt-2 flex items-start gap-1.5 rounded-card bg-warn-tint p-2.5 text-xs text-text">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" /> {answer.needsYou}
        </p>
      )}
      {!answer.edited && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          {removed.length ? `Fact-checked: removed ${removed.length} line${removed.length === 1 ? "" : "s"} not backed by your resume.` : "Fact-checked against your resume."}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {editing ? (
          <>
            <Button size="sm" onClick={() => void save()} loading={busy}>
              Save
            </Button>
            <Button size="sm" variant="text" onClick={() => (setText(answer.answer), setEditing(false))}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant={copied ? "inverse" : "secondary"} onClick={() => void copy()}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              <PenLine className="h-3 w-3" /> Edit
            </Button>
            <Button size="sm" variant="text" className="ml-auto" onClick={() => void remove()} disabled={busy} aria-label="Delete answer">
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
