"use client"

// Account menu -> Manage resumes: every kept master (including ones hidden by Replace),
// set one active, delete the rest.
import { useState } from "react"
import { Check, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { summarizeResume } from "@/lib/master-resume"
import { deleteMaster, setMasterHidden, type MasterResumeDTO } from "./api"
import { ErrorNote } from "./ui"

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

export function ManageResumesDialog({
  open,
  onOpenChange,
  masters,
  activeId,
  onActivate,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  masters: MasterResumeDTO[]
  activeId: string | null
  onActivate: (master: MasterResumeDTO) => void
  onDeleted: (id: string) => void
}) {
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState("")

  const activate = async (m: MasterResumeDTO) => {
    setError("")
    if (!m.hidden) {
      onActivate(m)
      return
    }
    setPending(m.id)
    const result = await setMasterHidden(m.id, false)
    setPending(null)
    if (result.ok) onActivate(result.master)
    else setError(result.error)
  }

  const remove = async (m: MasterResumeDTO) => {
    if (!confirm(`Delete "${m.title}"? Tailored resumes made from it stay in Recent and the tracker.`)) return
    setError("")
    setPending(m.id)
    const result = await deleteMaster(m.id)
    setPending(null)
    if (result.ok) onDeleted(m.id)
    else setError(result.error)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border border-white/10 bg-slate-900 text-slate-200">
        <DialogHeader>
          <DialogTitle className="text-white">Manage resumes</DialogTitle>
          <DialogDescription className="text-slate-400">The active resume is the one we tailor from. Replaced resumes are kept here until you delete them.</DialogDescription>
        </DialogHeader>
        {error && <ErrorNote>{error}</ErrorNote>}
        <ul className="max-h-[60vh] divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/5">
          {masters.length === 0 && <li className="p-4 text-sm text-slate-400">No resumes yet.</li>}
          {masters.map((m) => {
            const s = summarizeResume(m.resume)
            const isActive = m.id === activeId
            return (
              <li key={m.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-slate-100">
                    {m.title}
                    {isActive && <span className="rounded-full bg-emerald-500/15 px-2 text-[11px] text-emerald-300">Active</span>}
                    {m.hidden && !isActive && <span className="rounded-full bg-white/5 px-2 text-[11px] text-slate-400">Replaced</span>}
                    {m.staleParse && <span className="rounded-full bg-amber-400/10 px-2 text-[11px] text-amber-300">Old parser</span>}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {[s.headline, `${s.roles} ${s.roles === 1 ? "role" : "roles"}`, `added ${day(m.createdAt)}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {!isActive && (
                  <button
                    disabled={pending === m.id}
                    onClick={() => void activate(m)}
                    className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-slate-200 hover:bg-white/5 disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" /> Set active
                  </button>
                )}
                <button
                  disabled={pending === m.id}
                  onClick={() => void remove(m)}
                  aria-label={`Delete ${m.title}`}
                  title="Delete"
                  className="rounded-md p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            )
          })}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
