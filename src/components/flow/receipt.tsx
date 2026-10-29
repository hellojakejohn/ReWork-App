"use client"

// Result card -> "Your receipt" and one card per left-out claim. Every count comes from
// buildReceipt (src/lib/receipt.ts), which reads the saved tailor report. "Add it" sends
// the user's real number through the evidence interview's rewrite for that bullet (Pro),
// then Accept writes it to the master, exactly like the interview does.
import { useEffect, useMemo, useState } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { buildReceipt, type LeftOutClaim, type Receipt } from "@/lib/receipt"
import type { EvidenceAnswer, EvidenceItem, EvidenceRewrite } from "@/lib/evidence-shared"
import { applyEvidence, submitEvidence, type ApplicationDetailDTO, type MasterResumeDTO } from "./api"
import { ErrorNote, inputClass } from "./ui"

export const ADD_IT_UPSELL =
  "Adding the real number uses the evidence interview, a Pro feature: it rewrites the bullet from your answer only, and checks it the same way."

export function useReceipt(application: ApplicationDetailDTO): Receipt {
  return useMemo(() => buildReceipt(application), [application])
}

export function ReceiptCard({ receipt }: { receipt: Receipt }) {
  const row = "flex items-baseline justify-between gap-4 text-sm"
  return (
    <section aria-labelledby="receipt-title" className="rounded-card border border-border bg-surface p-5">
      <h3 id="receipt-title" className="font-bold text-text">
        Your receipt
      </h3>
      <span className="mt-1.5 inline-block rounded-full bg-sage px-2.5 py-0.5 text-xs font-semibold text-text">Checked against your resume</span>
      {receipt.match && <MatchMeter {...receipt.match} />}
      <dl className="mt-3 space-y-2">
        <div className={row}>
          <dt className="text-text-secondary">Improvements kept</dt>
          <dd className="font-bold tabular-nums text-text">{receipt.kept}</dd>
        </div>
        {receipt.keywordsAdded !== null && (
          <div className={row} title={receipt.keywordsAddedList.join(", ") || undefined}>
            <dt className="text-text-secondary">Job keywords added</dt>
            <dd className="font-bold tabular-nums text-text">{receipt.keywordsAdded}</dd>
          </div>
        )}
        <div className={row}>
          <dt className={receipt.leftOut.length ? "text-accent-strong" : "text-text-secondary"}>Left out</dt>
          <dd className={cn("font-bold tabular-nums", receipt.leftOut.length ? "text-accent-strong" : "text-text")}>{receipt.leftOut.length}</dd>
        </div>
        {receipt.restored > 0 && (
          <div className={row}>
            <dt className="text-text-secondary">Entries put back</dt>
            <dd className="font-bold tabular-nums text-text">{receipt.restored}</dd>
          </div>
        )}
        <div className={cn(row, "border-t border-dashed border-input pt-2.5 text-base")}>
          <dt className="font-bold text-success">Invented</dt>
          <dd className="font-bold tabular-nums text-success">{receipt.invented}</dd>
        </div>
      </dl>
    </section>
  )
}

// The share of the job's keywords your resume shows, before and after tailoring. It only
// rises with keywords you really have, so it's a floor, not a promise.
function MatchMeter({ before, after }: { before: number; after: number }) {
  const gain = after - before
  return (
    <div className="mt-4 rounded-input bg-surface-raised p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-text-secondary">Job match</p>
        <p className="tabular-nums text-text">
          <span className="text-text-muted">{before}%</span> <span aria-hidden>→</span>
          <span className="sr-only">to</span> <span className="text-2xl font-bold">{after}%</span>
        </p>
      </div>
      <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-border" aria-hidden>
        <div className="absolute inset-y-0 left-0 rounded-full bg-success" style={{ width: `${Math.min(100, after)}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-text-faint" style={{ width: `${Math.min(100, before, after)}%` }} />
      </div>
      <p className="mt-2 text-xs text-text-muted">
        {gain > 0 ? `+${gain} points. ` : ""}
        The job&apos;s keywords your resume shows, counting only what you really have.
      </p>
    </div>
  )
}

type CardState = { phase: "idle" } | { phase: "working" } | { phase: "review"; rewrite: EvidenceRewrite } | { phase: "saving"; rewrite: EvidenceRewrite } | { phase: "done"; message: string }

const storageKey = (applicationId: string) => `rework.leftout.${applicationId}`

function readHandled(applicationId: string): Record<string, "dismissed" | "added"> {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey(applicationId)) || "{}")
  } catch {
    return {}
  }
}

/** The left-out claims still waiting on the user ("Leave it out" and "Add it" are remembered per result). */
export function LeftOutList({
  application,
  receipt,
  isPro,
  onUpgrade,
  onMasterSaved,
}: {
  application: ApplicationDetailDTO
  receipt: Receipt
  isPro: boolean
  onUpgrade: (reason: string) => void
  onMasterSaved?: (master: MasterResumeDTO) => void
}) {
  const [handled, setHandled] = useState<Record<string, "dismissed" | "added">>({})
  useEffect(() => setHandled(readHandled(application.id)), [application.id])

  const mark = (key: string, value: "dismissed" | "added") => {
    const next = { ...handled, [key]: value }
    setHandled(next)
    try {
      window.localStorage.setItem(storageKey(application.id), JSON.stringify(next))
    } catch {
      // private mode: remembered for this page view only
    }
  }

  const open = receipt.leftOut.filter((c) => handled[c.key] !== "dismissed")
  if (open.length === 0) return null
  const count = receipt.leftOut.length
  return (
    <section aria-label="Left out" className="space-y-3">
      {open.map((claim, i) => (
        <LeftOutCard
          key={claim.key}
          title={i === 0 ? (count === 1 ? "We left one thing out" : `We left ${count} things out`) : undefined}
          claim={claim}
          application={application}
          isPro={isPro}
          added={handled[claim.key] === "added"}
          onUpgrade={onUpgrade}
          onDismiss={() => mark(claim.key, "dismissed")}
          onAdded={(master) => {
            mark(claim.key, "added")
            onMasterSaved?.(master)
          }}
        />
      ))}
    </section>
  )
}

function LeftOutCard({
  title,
  claim,
  application,
  isPro,
  added,
  onUpgrade,
  onDismiss,
  onAdded,
}: {
  title?: string
  claim: LeftOutClaim
  application: ApplicationDetailDTO
  isPro: boolean
  added: boolean
  onUpgrade: (reason: string) => void
  onDismiss: () => void
  onAdded: (master: MasterResumeDTO) => void
}) {
  const [value, setValue] = useState("")
  const [state, setState] = useState<CardState>(added ? { phase: "done", message: ADDED } : { phase: "idle" })
  const [error, setError] = useState("")
  const inputId = `real-number-${claim.key}`

  const add = async () => {
    if (!claim.evidence) return
    if (!isPro) {
      onUpgrade(ADD_IT_UPSELL)
      return
    }
    if (!value.trim()) {
      setError("Type the real number first, or leave it out.")
      return
    }
    setError("")
    setState({ phase: "working" })
    const { section, entryId, bullet } = claim.evidence
    // The question saved with the answer names the claim, so later tailors know what the number is about.
    const question = `The rewrite said "${claim.claim}", which isn't in your resume. What's the real number?`
    const item: EvidenceItem = {
      id: `leftout:${claim.key}`,
      section,
      entryId,
      entryLabel: "",
      index: -1,
      bullet,
      weakness: "Left out",
      questions: [{ id: "real-number", text: question }],
    }
    const answer: EvidenceAnswer = {
      itemId: item.id,
      entryLabel: "",
      bullet,
      questionId: "real-number",
      question,
      answer: value.trim(),
      answeredAt: new Date().toISOString(),
    }
    const result = await submitEvidence(application.resumeId, [item], [answer])
    if (!result.ok) {
      if (result.upgradeRequired) onUpgrade(result.error)
      setError(result.error)
      setState({ phase: "idle" })
      return
    }
    const rewrite = result.rewrites[0]
    if (!rewrite) {
      setState({ phase: "done", message: "That bullet has changed in your resume since this tailor, so there's nothing to add it to. Your answer is saved for next time." })
      return
    }
    setState({ phase: "review", rewrite })
  }

  const accept = async (rewrite: EvidenceRewrite) => {
    setError("")
    setState({ phase: "saving", rewrite })
    const result = await applyEvidence(application.resumeId, [rewrite])
    if (!result.ok) {
      setError(result.error)
      setState({ phase: "review", rewrite })
      return
    }
    setState({ phase: "done", message: ADDED })
    onAdded(result.master)
  }

  return (
    <article className="rounded-card border border-border bg-surface p-5 text-sm">
      {title && <h3 className="mb-2 font-bold text-text">{title}</h3>}
      <p className="text-text-muted">
        <s>{claim.claim}</s>
        <span className="sr-only"> (left out)</span>
      </p>
      <p className="mt-2 leading-relaxed text-text-secondary">{claim.question}</p>

      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {state.phase === "done" ? (
        <p className="mt-3 flex items-start gap-2 text-text">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" aria-hidden />
          {state.message}
        </p>
      ) : state.phase === "review" || state.phase === "saving" ? (
        <div className="mt-3 space-y-3">
          {state.rewrite.warning ? (
            <p className="rounded-input bg-warn-tint px-3 py-2 text-text">{state.rewrite.warning}</p>
          ) : (
            <div className="rounded-input bg-success-tint px-3 py-2">
              <p className="text-xs font-semibold text-text-muted">With your number</p>
              <p className="mt-0.5 text-text">{state.rewrite.after}</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {!state.rewrite.warning && state.rewrite.after !== state.rewrite.before && (
              <Button loading={state.phase === "saving"} onClick={() => void accept(state.rewrite)}>
                Use it
              </Button>
            )}
            <Button variant="text" disabled={state.phase === "saving"} onClick={onDismiss}>
              Leave it out
            </Button>
          </div>
        </div>
      ) : claim.evidence ? (
        <div className="mt-3 space-y-3">
          {isPro ? (
            <div>
              <label htmlFor={inputId} className="mb-1.5 block text-xs font-bold text-text">
                The real number
              </label>
              <input
                id={inputId}
                className={cn(inputClass, "py-2.5")}
                placeholder="e.g. 12% in Q3"
                value={value}
                maxLength={300}
                disabled={state.phase === "working"}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void add()
                }}
              />
            </div>
          ) : (
            <p className="text-xs text-text-muted">Adding the real number is part of Pro.</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button loading={state.phase === "working"} onClick={() => void add()}>
              Add it
            </Button>
            <Button variant="text" disabled={state.phase === "working"} onClick={onDismiss}>
              Leave it out
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <Button variant="text" size="sm" className="-ml-3" onClick={onDismiss}>
            Got it
          </Button>
        </div>
      )}
    </article>
  )
}

const ADDED = "Added to your resume. Tailor this job again to use it here."
