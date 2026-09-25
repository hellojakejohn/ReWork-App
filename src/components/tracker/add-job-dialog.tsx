"use client"

// Tracker -> "Add a job": track something without tailoring it. Paste a link to autofill
// through the job resolver, or type it in.
import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { addTrackedJob, fetchJobFromUrl, type JobDraft, type TrackerCardDTO } from "@/components/flow/api"
import { ErrorNote, PrimaryButton, SecondaryButton, inputClass } from "@/components/flow/ui"

const EMPTY: JobDraft = { url: "", title: "", company: "", location: "", description: "" }

export function AddJobDialog({
  open,
  onOpenChange,
  onAdded,
  onLimit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: (app: TrackerCardDTO) => void
  onLimit: (reason: string) => void
}) {
  const [job, setJob] = useState<JobDraft>(EMPTY)
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState("")
  const [error, setError] = useState("")

  const reset = () => {
    setJob(EMPTY)
    setNote("")
    setError("")
  }

  const autofill = async () => {
    const raw = job.url.trim()
    if (!raw) return
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    setError("")
    setNote("")
    setFetching(true)
    const result = await fetchJobFromUrl(url)
    setFetching(false)
    if (result.ok) setJob({ ...result.job, url })
    else if ("needsPaste" in result) {
      setJob((j) => ({ ...j, url }))
      setNote(`${result.message} Fill in the title and company below; the description is optional.`)
    } else setError(result.error)
  }

  const save = async () => {
    setError("")
    setSaving(true)
    const result = await addTrackedJob(job)
    setSaving(false)
    if (!result.ok) {
      if (result.upgradeRequired) {
        onOpenChange(false)
        onLimit(result.error)
      }
      setError(result.error)
      return
    }
    onAdded(result.application)
    reset()
    onOpenChange(false)
  }

  const field = (key: keyof JobDraft, label: string, placeholder = "") => (
    <label className="block space-y-1">
      <span className="text-xs text-slate-400">{label}</span>
      <input className={inputClass} placeholder={placeholder} value={job[key] ?? ""} onChange={(e) => setJob((j) => ({ ...j, [key]: e.target.value }))} />
    </label>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-lg border border-white/10 bg-slate-900 text-slate-200">
        <DialogHeader>
          <DialogTitle className="text-white">Add a job</DialogTitle>
          <DialogDescription className="text-slate-400">Track it here now; tailor for it whenever you want.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <div className="flex gap-2">
            <input
              className={inputClass}
              placeholder="Paste the job posting link"
              value={job.url}
              onChange={(e) => setJob((j) => ({ ...j, url: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void autofill()
                }
              }}
            />
            <SecondaryButton type="button" onClick={() => void autofill()} disabled={fetching || !job.url.trim()}>
              {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Autofill"}
            </SecondaryButton>
          </div>
          {note && <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-100">{note}</p>}
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="grid gap-3 sm:grid-cols-2">
            {field("title", "Job title")}
            {field("company", "Company")}
          </div>
          {field("location", "Location", "Optional")}
          <label className="block space-y-1">
            <span className="text-xs text-slate-400">Description (optional, needed later to tailor)</span>
            <textarea className={`${inputClass} min-h-[96px]`} value={job.description} onChange={(e) => setJob((j) => ({ ...j, description: e.target.value }))} />
          </label>
          <div className="flex justify-end gap-2">
            <SecondaryButton type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" loading={saving} disabled={!job.title.trim() || !job.company.trim()}>
              Add to tracker
            </PrimaryButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
