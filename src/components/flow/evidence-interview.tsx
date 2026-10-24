"use client"

// Evidence interview, inside the Resume card: one weak bullet at a time (sliding like the
// rest of the flow), short answers, Skip / Next. Then before/after per bullet with
// Accept / Reject; accepted rewrites are written to the master.
import { Button } from "@/components/ui/button"
import { useEffect, useRef, useState } from "react"
import { Check, Loader2, ShieldCheck, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { isNonAnswer, type EvidenceAnswer, type EvidenceItem, type EvidenceRewrite } from "@/lib/evidence-shared"
import { applyEvidence, startEvidence, submitEvidence, type EvidenceFocus, type MasterResumeDTO } from "./api"
import { Card, CardBody, CardFooter, CardHeader, ErrorNote, inputClass } from "./ui"

type Phase = "loading" | "asking" | "rewriting" | "review" | "saving" | "done" | "empty"

export function EvidenceInterview({
  master,
  focus,
  onClose,
  onSaved,
  onUpgrade,
}: {
  master: MasterResumeDTO
  focus: EvidenceFocus | null
  onClose: () => void
  onSaved: (master: MasterResumeDTO, applied: number) => void
  onUpgrade: (reason: string) => void
}) {
  const [phase, setPhase] = useState<Phase>("loading")
  const [items, setItems] = useState<EvidenceItem[]>([])
  const [values, setValues] = useState<Record<string, string>>({}) // questionId -> answer
  const [index, setIndex] = useState(0)
  const [rewrites, setRewrites] = useState<EvidenceRewrite[]>([])
  const [decisions, setDecisions] = useState<Record<string, boolean>>({}) // itemId -> accepted
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const firstInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await startEvidence(master.id, focus)
      if (cancelled) return
      if (!result.ok) {
        if (result.upgradeRequired) {
          onUpgrade(result.error)
          onClose()
          return
        }
        setError(result.error)
        setPhase("empty")
        return
      }
      if (result.items.length === 0) {
        setMessage(result.message || "Nothing to ask about right now.")
        setPhase("empty")
        return
      }
      // Prefill answers given before for the same bullet + question.
      const prefill: Record<string, string> = {}
      for (const item of result.items) {
        for (const q of item.questions) {
          const prior = result.answers.find((a) => a.bullet === item.bullet && a.question === q.text)
          if (prior) prefill[q.id] = prior.answer
        }
      }
      setItems(result.items)
      setValues(prefill)
      setPhase("asking")
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [master.id, focus?.entryId, focus?.bullet])

  useEffect(() => {
    if (phase === "asking") firstInput.current?.focus({ preventScroll: true })
  }, [phase, index])

  const toAnswers = (from: Record<string, string>): EvidenceAnswer[] =>
    items.flatMap((item) =>
      item.questions
        .filter((q) => (from[q.id] ?? "").trim())
        .map((q) => ({
          itemId: item.id,
          entryLabel: item.entryLabel,
          bullet: item.bullet,
          questionId: q.id,
          question: q.text,
          answer: from[q.id].trim(),
          answeredAt: new Date().toISOString(),
        }))
    )

  const finish = async (from = values) => {
    setError("")
    setPhase("rewriting")
    const result = await submitEvidence(master.id, items, toAnswers(from))
    if (!result.ok) {
      setError(result.error)
      setPhase("asking")
      return
    }
    if (result.rewrites.length === 0) {
      setMessage("No answers with details to use, so nothing to rewrite. Anything you typed is saved for later.")
      setPhase("done")
      return
    }
    setRewrites(result.rewrites)
    setDecisions(Object.fromEntries(result.rewrites.map((r) => [r.itemId, !r.warning && r.after !== r.before])))
    setPhase("review")
  }

  const next = (from = values) => (index < items.length - 1 ? setIndex(index + 1) : void finish(from))
  const skip = () => {
    const out = { ...values }
    for (const q of items[index].questions) delete out[q.id]
    setValues(out)
    next(out)
  }

  const save = async () => {
    const accepted = rewrites.filter((r) => decisions[r.itemId])
    if (accepted.length === 0) {
      onClose()
      return
    }
    setPhase("saving")
    const result = await applyEvidence(master.id, accepted)
    if (!result.ok) {
      setError(result.error)
      setPhase("review")
      return
    }
    onSaved(result.master, result.applied)
  }

  const header = (
    <CardHeader
      title="Make it stronger"
      subtitle={
        phase === "asking"
          ? `Real numbers beat invented ones. ${index + 1} of ${items.length}`
          : phase === "review" || phase === "saving"
            ? "Rewritten from your answers only. Accept what's right."
            : "We ask, you answer. Nothing gets made up."
      }
      onBack={phase === "rewriting" || phase === "saving" ? undefined : onClose}
    />
  )

  if (phase === "loading" || phase === "rewriting") {
    return (
      <Card>
        {header}
        <CardBody>
          <p className="flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
            {phase === "loading" ? "Finding your weakest bullets…" : "Rewriting with your answers and fact-checking…"}
          </p>
        </CardBody>
      </Card>
    )
  }

  if (phase === "empty" || phase === "done") {
    return (
      <Card>
        {header}
        <CardBody className="space-y-3">
          {error ? <ErrorNote>{error}</ErrorNote> : <p className="text-sm text-text-secondary">{message}</p>}
        </CardBody>
        <CardFooter>
          <Button onClick={onClose}>Back to my resume</Button>
        </CardFooter>
      </Card>
    )
  }

  if (phase === "review" || phase === "saving") {
    const count = rewrites.filter((r) => decisions[r.itemId]).length
    return (
      <Card>
        {header}
        <CardBody className="space-y-3">
          {error && <ErrorNote>{error}</ErrorNote>}
          {rewrites.map((r) => {
            const accepted = !!decisions[r.itemId]
            const unchanged = r.after === r.before
            return (
              <div key={r.itemId} className="rounded-input border border-border bg-surface-raised p-3 text-sm">
                <p className="mb-1.5 text-xs font-medium text-text-muted">{r.entryLabel}</p>
                <p className={cn("text-text-muted", accepted && "line-through decoration-text-faint")}>{r.before}</p>
                {!unchanged && <p className={cn("mt-1", accepted ? "text-text" : "text-text-muted")}>{r.after}</p>}
                {r.warning && <p className="mt-1.5 text-xs text-warn">{r.warning}</p>}
                {!unchanged && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant={accepted ? "inverse" : "secondary"}
                      aria-pressed={accepted}
                      onClick={() => setDecisions((d) => ({ ...d, [r.itemId]: true }))}
                    >
                      <Check className="h-3 w-3" /> {accepted ? "Accepted" : "Accept"}
                    </Button>
                    <Button
                      size="sm"
                      variant={!accepted ? "inverse" : "secondary"}
                      aria-pressed={!accepted}
                      onClick={() => setDecisions((d) => ({ ...d, [r.itemId]: false }))}
                    >
                      <X className="h-3 w-3" /> {accepted ? "Reject" : "Rejected"}
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
          <p className="flex items-center gap-2 text-xs text-text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-success" /> Every number above came from your answers. Your answers are saved either way.
          </p>
        </CardBody>
        <CardFooter>
          <Button variant="secondary" onClick={onClose} disabled={phase === "saving"}>
            Cancel
          </Button>
          <Button loading={phase === "saving"} onClick={() => void save()}>
            {count > 0 ? `Save ${count} to my resume` : "Done"}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // asking
  return (
    <Card>
      {header}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className="flex h-full transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {items.map((item, i) => (
            <div
              key={item.id}
              aria-hidden={i !== index}
              inert={i !== index}
              className="h-full w-full shrink-0 space-y-4 overflow-y-auto px-5 py-4"
            >
              {error && i === index && <ErrorNote>{error}</ErrorNote>}
              <div className="rounded-input border border-border bg-surface-raised p-3">
                <p className="mb-1 text-xs font-medium text-text-muted">
                  {item.entryLabel}
                  {item.weakness && <span className="ml-2 rounded-full bg-warn-tint px-2 text-xs text-warn">{item.weakness}</span>}
                </p>
                <p className="text-sm text-text">{item.bullet}</p>
              </div>
              {item.questions.map((q, qi) => (
                <label key={q.id} className="block space-y-1.5">
                  <span className="text-sm text-text-secondary">{q.text}</span>
                  <div className="flex gap-2">
                    <input
                      ref={i === index && qi === 0 ? firstInput : undefined}
                      className={inputClass}
                      maxLength={300}
                      placeholder="A few words, or don't know"
                      value={values[q.id] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [q.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          next()
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant={(values[q.id] ?? "").trim() && isNonAnswer(values[q.id]) ? "inverse" : "secondary"}
                      className="h-auto self-stretch"
                      onClick={() => setValues((v) => ({ ...v, [q.id]: "don't know" }))}
                    >
                      Don&apos;t know
                    </Button>
                  </div>
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>
      <CardFooter>
        {index > 0 && (
          <Button variant="secondary" className="mr-auto" onClick={() => setIndex(index - 1)}>
            Back
          </Button>
        )}
        <Button variant="secondary" onClick={skip}>Skip</Button>
        <Button onClick={() => next()}>{index < items.length - 1 ? "Next" : "Rewrite my bullets"}</Button>
      </CardFooter>
    </Card>
  )
}
