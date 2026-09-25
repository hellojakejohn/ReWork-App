"use client"

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
        className={cn("absolute inset-0 bg-black/50 transition-opacity duration-200 motion-reduce:transition-none", open ? "opacity-100" : "opacity-0")}
      />
      <aside
        role={open ? "dialog" : undefined}
        aria-label="Recent tailored resumes"
        aria-modal={open || undefined}
        inert={!open}
        className={cn(
          "absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-white/10 bg-slate-900 transition-transform duration-300 ease-out motion-reduce:transition-none",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">Recent</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-white/5 overflow-y-auto">
          {applications.length === 0 && <li className="p-4 text-sm text-slate-400">Your tailored resumes will show up here.</li>}
          {applications.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => onOpen(a.id)}
                className={cn("w-full px-4 py-3 text-left hover:bg-white/5", a.id === activeId && "bg-white/5")}
              >
                <p className="truncate text-sm font-medium text-slate-100">{a.jobTitle}</p>
                <p className="truncate text-xs text-slate-400">{a.company}</p>
                <p className="mt-1 flex justify-between text-[11px] text-slate-500">
                  <span>{new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  {a.coverageAfter !== null && (
                    <span>
                      {a.coverageBefore !== null ? `${a.coverageBefore}% → ` : ""}
                      <span className="text-emerald-300">{a.coverageAfter}%</span> keywords
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
