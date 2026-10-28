"use client"

// Account menu -> Manage resumes: every kept master (including ones hidden by Replace),
// set one active, delete the rest.
import { Button } from "@/components/ui/button"
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
      <DialogContent className="max-w-lg border border-border bg-surface text-text">
        <DialogHeader>
          <DialogTitle className="text-text">Manage resumes</DialogTitle>
          <DialogDescription className="text-text-muted">The active resume is the one we tailor from. Replaced resumes are kept here until you delete them.</DialogDescription>
        </DialogHeader>
        {error && <ErrorNote>{error}</ErrorNote>}
        <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto rounded-input border border-border">
          {masters.length === 0 && <li className="p-4 text-sm text-text-muted">No resumes yet.</li>}
          {masters.map((m) => {
            const s = summarizeResume(m.resume)
            const isActive = m.id === activeId
            return (
              <li key={m.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-text">
                    {m.title}
                    {isActive && <span className="rounded-full bg-sage px-2 text-xs font-semibold text-text">Active</span>}
                    {m.hidden && !isActive && <span className="rounded-full bg-surface-raised px-2 text-xs text-text-muted">Replaced</span>}
                    {m.staleParse && <span className="rounded-full bg-warn-tint px-2 text-xs text-warn">Old parser</span>}
                  </p>
                  <p className="truncate text-xs text-text-muted">
                    {[s.headline, `${s.roles} ${s.roles === 1 ? "role" : "roles"}`, `added ${day(m.createdAt)}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {!isActive && (
                  <Button variant="secondary" size="sm" disabled={pending === m.id} onClick={() => void activate(m)}>
                    <Check className="h-3 w-3" /> Set active
                  </Button>
                )}
                <Button
                  variant="text"
                  size="icon"
                  disabled={pending === m.id}
                  onClick={() => void remove(m)}
                  aria-label={`Delete ${m.title}`}
                  title="Delete"
                  className="hover:bg-removed hover:text-accent-strong"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            )
          })}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
