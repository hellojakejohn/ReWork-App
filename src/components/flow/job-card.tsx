"use client"

import { useEffect, useRef, useState } from "react"
import { Link2, Loader2, MapPin, Pencil } from "lucide-react"
import { fetchJobFromUrl, type JobDraft } from "./api"
import { Card, CardBody, CardFooter, CardHeader, ErrorNote, PrimaryButton, SecondaryButton, inputClass } from "./ui"
import { useAdvance } from "./use-advance"
import { INPUT_LIMITS, INPUT_LIMIT_MESSAGES } from "@/lib/plans"

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
  const request = useRef(0)

  // Follow the parent: "Tailor for another job" clears the job (start over at the URL
  // box); reopening a tailored resume from Recent sets it.
  useEffect(() => {
    setEditing(false)
    setError("")
    setPasteNote("")
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

  const set = (patch: Partial<JobDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const fields = (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Job title</span>
          <input className={inputClass} value={draft.title} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Company</span>
          <input className={inputClass} value={draft.company} onChange={(e) => set({ company: e.target.value })} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-400">Location (optional)</span>
        <input className={inputClass} value={draft.location} onChange={(e) => set({ location: e.target.value })} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-400">Job description</span>
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
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
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
              <p className="flex items-center gap-2 text-sm text-slate-400" aria-live="polite">
                <Loader2 className="h-4 w-4 animate-spin" /> Reading the posting...
              </p>
            )}
            {error && <ErrorNote>{error}</ErrorNote>}
            <p className="text-xs text-slate-500">Works best with Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Workable and most company career pages.</p>
          </>
        )}

        {mode === "paste" && (
          <>
            {pasteNote && <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300">{pasteNote}</p>}
            {fields}
          </>
        )}

        {mode === "fetched" &&
          (editing ? (
            fields
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-lg font-semibold text-white">{draft.title}</p>
                <p className="text-sm text-slate-300">{draft.company}</p>
                {draft.location && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                    <MapPin className="h-3 w-3" /> {draft.location}
                  </p>
                )}
              </div>
              <div className="relative max-h-56 overflow-hidden rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{draft.description.slice(0, 1200)}</p>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-900 to-transparent" />
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
          <SecondaryButton onClick={() => setEditing((v) => !v)}>
            <Pencil className="h-3.5 w-3.5" /> {editing ? "Done editing" : "Edit"}
          </SecondaryButton>
        )}
        {(mode === "url" || mode === "fetching") && (
          <button
            type="button"
            className="mr-auto text-sm text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
            onClick={() => {
              setPasteNote("")
              setMode("paste")
            }}
          >
            Paste the description instead
          </button>
        )}
        {mode === "paste" && (
          <button
            type="button"
            className="mr-auto text-sm text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
            onClick={() => setMode("url")}
          >
            Use a link instead
          </button>
        )}
        {mode === "url" || mode === "fetching" ? (
          <PrimaryButton loading={mode === "fetching"} disabled={!draft.url.trim()} onClick={() => void fetchUrl(draft.url)}>
            Fetch
          </PrimaryButton>
        ) : (
          <PrimaryButton disabled={!valid} onClick={() => onConfirm(draft)}>
            Looks good
          </PrimaryButton>
        )}
      </CardFooter>
    </Card>
  )
}
