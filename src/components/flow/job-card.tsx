"use client"

import { Button } from "@/components/ui/button"
import { useEffect, useRef, useState } from "react"
import { ChevronDown, Link2, Loader2, MapPin, Pencil } from "lucide-react"
import { fetchJobFromUrl, type JobDraft } from "./api"
import { Card, CardBody, CardFooter, CardHeader, ErrorNote, inputClass } from "./ui"
import { useAdvance } from "./use-advance"
import { INPUT_LIMITS, INPUT_LIMIT_MESSAGES } from "@/lib/plans"
import { otherCompanyNamed } from "@/lib/job-checks"

type Mode = "url" | "fetching" | "fetched" | "paste"

const EMPTY: JobDraft = { url: "", title: "", company: "", location: "", description: "" }
const MIN_DESCRIPTION = 50

export function jobIsValid(job: JobDraft): boolean {
  return (
    !!job.title.trim() &&
    !!job.company.trim() &&
    job.description.trim().length >= MIN_DESCRIPTION &&
    job.description.length <= INPUT_LIMITS.jobDescriptionChars
  )
}

export function JobCard({
  job,
  isActiveStep,
  onBack,
  onConfirm,
}: {
  job: JobDraft | null
  isActiveStep: boolean
  onBack: () => void
  onConfirm: (job: JobDraft) => void
}) {
  const [draft, setDraft] = useState<JobDraft>(job ?? EMPTY)
  const [mode, setMode] = useState<Mode>(job ? "fetched" : "url")
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState("")
  const [pasteNote, setPasteNote] = useState("")
  const [expanded, setExpanded] = useState(false)
  // Only offer "Show the full description" when the collapsed box actually cuts it off.
  const [overflows, setOverflows] = useState(false)
  const descriptionBox = useRef<HTMLDivElement>(null)
  const request = useRef(0)

  // Follow the parent: "Tailor for another job" clears the job (start over at the URL
  // box); reopening a tailored resume from Recent sets it.
  useEffect(() => {
    setEditing(false)
    setError("")
    setPasteNote("")
    setExpanded(false)
    if (job === null) {
      setDraft(EMPTY)
      setMode("url")
    } else {
      setDraft(job)
      setMode("fetched")
    }
  }, [job])

  const fetchUrl = async (raw: string) => {
    const url = raw.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url) && !/^[\w-]+(\.[\w-]+)+\//.test(url)) {
      setError("That doesn't look like a link. Paste the job posting's URL.")
      return
    }
    const full = /^https?:\/\//i.test(url) ? url : `https://${url}`
    const id = ++request.current
    setError("")
    setPasteNote("")
    setMode("fetching")
    const result = await fetchJobFromUrl(full)
    if (id !== request.current) return
    if (result.ok) {
      setDraft(result.job)
      setEditing(!result.job.title || !result.job.company)
      setMode("fetched")
    } else if ("needsPaste" in result) {
      setDraft({ ...EMPTY, url: full })
      setPasteNote(result.message)
      setMode("paste")
    } else {
      setError(result.error)
      setMode("url")
    }
  }

  const valid = jobIsValid(draft)
  useAdvance(isActiveStep && (mode === "fetched" || mode === "paste") && valid, () => onConfirm(draft))

  useEffect(() => {
    const box = descriptionBox.current
    if (!box || expanded) return
    const measure = () => setOverflows(box.scrollHeight > box.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [draft.description, mode, editing, expanded])

  const set = (patch: Partial<JobDraft>) => setDraft((d) => ({ ...d, ...patch }))
  // A job board reposting another company's ad: the cover letter would greet the wrong one.
  const otherCompany = otherCompanyNamed(draft.description, draft.company)
  const companyNote = otherCompany && (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-input border border-border bg-surface-raised px-3 py-2 text-sm text-text-secondary" role="status">
      <span className="flex-1">
        This description is about <strong className="text-text">{otherCompany}</strong>, but the company says {draft.company}. Your cover letter is addressed to the company.
      </span>
      <Button variant="text" className="-mx-2" onClick={() => set({ company: otherCompany })}>
        Use {otherCompany}
      </Button>
    </div>
  )
  const fields = (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-text-muted">Job title</span>
          <input className={inputClass} value={draft.title} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-text-muted">Company</span>
          <input className={inputClass} value={draft.company} onChange={(e) => set({ company: e.target.value })} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-text-muted">Location (optional)</span>
        <input className={inputClass} value={draft.location} onChange={(e) => set({ location: e.target.value })} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-text-muted">Job description</span>
        <textarea
          className={`${inputClass} min-h-[180px]`}
          value={draft.description}
          placeholder="Paste the full posting: responsibilities, requirements, nice-to-haves."
          onChange={(e) => set({ description: e.target.value })}
        />
      </label>
      {draft.description.length > INPUT_LIMITS.jobDescriptionChars && <ErrorNote>{INPUT_LIMIT_MESSAGES.jobDescription}</ErrorNote>}
    </div>
  )

  return (
    <Card>
      <CardHeader title="The job" subtitle="Paste a link to the posting." onBack={onBack} />
      <CardBody className="space-y-4">
        {(mode === "url" || mode === "fetching") && (
          <>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="url"
                inputMode="url"
                autoFocus={isActiveStep}
                placeholder="https://boards.greenhouse.io/company/jobs/123"
                className={`${inputClass} py-3 pl-9 text-base`}
                value={draft.url}
                disabled={mode === "fetching"}
                onChange={(e) => set({ url: e.target.value })}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text")
                  if (pasted) {
                    e.preventDefault()
                    set({ url: pasted.trim() })
                    void fetchUrl(pasted)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    void fetchUrl(draft.url)
                  }
                }}
              />
            </div>
            {mode === "fetching" && (
              <p className="flex items-center gap-2 text-sm text-text-muted" aria-live="polite">
                <Loader2 className="h-4 w-4 animate-spin" /> Reading the posting...
              </p>
            )}
            {error && <ErrorNote>{error}</ErrorNote>}
            <p className="text-xs text-text-muted">Works best with Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Workable and most company career pages.</p>
          </>
        )}

        {mode === "paste" && (
          <>
            {pasteNote && <p className="rounded-input border border-border bg-surface-raised px-3 py-2 text-sm text-text-secondary">{pasteNote}</p>}
            {fields}
            {companyNote}
          </>
        )}

        {mode === "fetched" &&
          (editing ? (
            <>
              {fields}
              {companyNote}
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-lg font-semibold text-text">{draft.title}</p>
                <p className="text-sm text-text-secondary">{draft.company}</p>
                {draft.location && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-text-muted">
                    <MapPin className="h-3 w-3" /> {draft.location}
                  </p>
                )}
              </div>
              {companyNote}
              <div className="rounded-input border border-border bg-surface-raised">
                <div
                  ref={descriptionBox}
                  className={`relative p-3 ${expanded ? "max-h-[60vh] overflow-y-auto" : "max-h-56 overflow-hidden"}`}
                  tabIndex={expanded ? 0 : undefined}
                  aria-label="Job description"
                >
                  <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">{draft.description}</p>
                  {!expanded && overflows && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-surface-raised to-transparent" />}
                </div>
                {(overflows || expanded) && <button
                  type="button"
                  className="flex w-full items-center justify-center gap-1 border-t border-border px-3 py-2 text-xs font-medium text-text-secondary hover:text-text"
                  aria-expanded={expanded}
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? "Show less" : "Show the full description"}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>}
              </div>
              {!valid && (
                <ErrorNote>
                  {draft.description.length > INPUT_LIMITS.jobDescriptionChars
                    ? INPUT_LIMIT_MESSAGES.jobDescription
                    : "The description looks too short. Edit it to paste the full posting."}
                </ErrorNote>
              )}
            </div>
          ))}
      </CardBody>
      <CardFooter>
        {mode === "fetched" && (
          <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
            <Pencil className="h-3.5 w-3.5" /> {editing ? "Done editing" : "Edit"}
          </Button>
        )}
        {(mode === "url" || mode === "fetching") && (
          <Button
            variant="text"
            className="-ml-3 mr-auto"
            onClick={() => {
              setPasteNote("")
              setMode("paste")
            }}
          >
            Paste the description instead
          </Button>
        )}
        {mode === "paste" && (
          <Button variant="text" className="-ml-3 mr-auto" onClick={() => setMode("url")}>
            Use a link instead
          </Button>
        )}
        {mode === "url" || mode === "fetching" ? (
          <Button loading={mode === "fetching"} disabled={!draft.url.trim()} onClick={() => void fetchUrl(draft.url)}>
            Fetch
          </Button>
        ) : (
          <Button disabled={!valid} onClick={() => onConfirm(draft)}>
            Looks good
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
