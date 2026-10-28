"use client"

import { Button } from "@/components/ui/button"
import { useEffect } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ApplicationSummaryDTO } from "./api"

export function RecentDrawer({
  open,
  applications,
  activeId,
  onClose,
  onOpen,
}: {
  open: boolean
  applications: ApplicationSummaryDTO[]
  activeId: string | null
  onClose: () => void
  onOpen: (id: string) => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [open, onClose])

  return (
    <div className={cn("fixed inset-0 z-50", open ? "" : "pointer-events-none")} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={cn("absolute inset-0 bg-[rgb(var(--shadow)/0.45)] transition-opacity duration-200 motion-reduce:transition-none", open ? "opacity-100" : "opacity-0")}
      />
      <aside
        role={open ? "dialog" : undefined}
        aria-label="Recent tailored resumes"
        aria-modal={open || undefined}
        inert={!open}
        className={cn(
          "absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-border bg-surface transition-transform duration-300 ease-out motion-reduce:transition-none",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-serif text-lg font-semibold text-text">Recent</h2>
          <Button variant="text" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          {applications.length === 0 && <li className="p-4 text-sm text-text-muted">Your tailored resumes will show up here.</li>}
          {applications.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => onOpen(a.id)}
                className={cn("w-full px-4 py-3 text-left hover:bg-surface-raised", a.id === activeId && "bg-surface-raised")}
              >
                <p className="truncate text-sm font-medium text-text">{a.jobTitle}</p>
                <p className="truncate text-xs text-text-muted">{a.company}</p>
                <p className="mt-1 flex justify-between text-xs text-text-muted">
                  <span>{new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  {a.coverageAfter !== null && (
                    <span>
                      {a.coverageBefore !== null ? `${a.coverageBefore}% → ` : ""}
                      <span className="text-success">{a.coverageAfter}%</span> keywords
                    </span>
                  )}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
