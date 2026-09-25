"use client"

// One application on the tracker: what it is, where it stands, links back into the flow,
// downloads, notes and a follow-up date.
import { useEffect, useState } from "react"
import Link from "next/link"
import { CalendarClock, ChevronDown, Download, ExternalLink, FileText, MoreHorizontal, StickyNote, Trash2, Wand2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { TRACKER_COLUMNS, columnOf, type TrackerColumn } from "@/lib/tracker"
import type { TemplateId } from "@/lib/resume-templates"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { TrackerCardDTO } from "@/components/flow/api"

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
const todayISO = () => new Date().toLocaleDateString("en-CA") // YYYY-MM-DD, local

function statusLine(app: TrackerCardDTO): string {
  const column = TRACKER_COLUMNS.find((c) => c.id === columnOf(app.status))!
  if (column.id === "saved") return app.tailored ? `Tailored ${day(app.createdAt)}` : `Added ${day(app.createdAt)}`
  return `${column.label} ${day(app.statusUpdatedAt)}`
}

export function TrackerCard({
  app,
  template,
  dragging,
  onMove,
  onSave,
  onDelete,
}: {
  app: TrackerCardDTO
  template: TemplateId
  dragging?: boolean
  onMove: (column: TrackerColumn) => void
  onSave: (patch: { notes?: string; followUpAt?: string | null }) => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState(app.notes)
  useEffect(() => setNotes(app.notes), [app.notes])

  const due = app.followUpAt && app.followUpAt <= todayISO() && !["offer", "rejected"].includes(columnOf(app.status))
  const resume = `/api/resumes/${app.resumeId}/download?applicationId=${app.id}&template=${template}`
  const letter = `/api/resumes/applications/${app.id}/cover-letter/download?template=${template}`
  const menuItem = "cursor-pointer text-slate-200 focus:bg-white/10 focus:text-white"
  // Links inside a draggable card: don't let a click start a drag.
  const stop = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation(), onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation() }

  return (
    <div className={cn("rounded-xl border border-white/10 bg-slate-900 p-3 text-sm shadow-sm", dragging && "opacity-40")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-100">{app.company}</p>
          <p className="truncate text-xs text-slate-400">{app.jobTitle}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger {...stop} className="rounded-md p-1 text-slate-500 hover:bg-white/5 hover:text-slate-200" aria-label={`More for ${app.company}`}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 border-white/10 bg-slate-900 text-slate-200">
            {app.tailored ? (
              <>
                <DropdownMenuLabel className="text-xs font-normal text-slate-400">PDF for humans, Word for application portals.</DropdownMenuLabel>
                <DropdownMenuItem asChild className={menuItem}>
                  <a href={resume}><FileText className="mr-2 h-4 w-4" /> Resume PDF</a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className={menuItem}>
                  <a href={`${resume}&format=docx`}><Download className="mr-2 h-4 w-4" /> Resume Word</a>
                </DropdownMenuItem>
                {app.hasCoverLetter && (
                  <>
                    <DropdownMenuItem asChild className={menuItem}>
                      <a href={`${letter}&format=pdf`}><FileText className="mr-2 h-4 w-4" /> Cover letter PDF</a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className={menuItem}>
                      <a href={`${letter}&format=docx`}><Download className="mr-2 h-4 w-4" /> Cover letter Word</a>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="bg-white/10" />
              </>
            ) : null}
            <DropdownMenuItem onSelect={onDelete} className="cursor-pointer text-red-300 focus:bg-red-500/10 focus:text-red-200">
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
        <span>{statusLine(app)}</span>
        {app.coverageAfter !== null && app.tailored && (
          <span>
            · <span className="text-emerald-300">{app.coverageAfter}%</span> keywords
          </span>
        )}
        {app.followUpAt && (
          <span className={cn("flex items-center gap-1", due ? "text-amber-300" : "")}>
            · <CalendarClock className="h-3 w-3" /> {due ? "Follow up" : "Follow-up"} {day(`${app.followUpAt}T12:00:00`)}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs" {...stop}>
        {app.tailored ? (
          <Link href={`/dashboard?application=${app.id}`} className="rounded-md border border-white/10 px-2 py-1 text-slate-200 hover:bg-white/5">
            Open result
          </Link>
        ) : (
          <Link href={`/dashboard?tailor=${app.id}`} className="flex items-center gap-1 rounded-md border border-emerald-500/30 px-2 py-1 text-emerald-300 hover:bg-emerald-500/10">
            <Wand2 className="h-3 w-3" /> Tailor for it
          </Link>
        )}
        {app.jobUrl && (
          <a href={app.jobUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-md px-2 py-1 text-slate-400 hover:bg-white/5 hover:text-slate-200">
            Posting <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cn("ml-auto flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/5", app.notes ? "text-slate-200" : "text-slate-400")}
        >
          <StickyNote className="h-3 w-3" /> Notes <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {/* Status on small screens, where dragging between columns isn't practical. */}
      <label className="mt-2 block md:hidden" {...stop}>
        <span className="sr-only">Status</span>
        <select
          value={columnOf(app.status)}
          onChange={(e) => onMove(e.target.value as TrackerColumn)}
          className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
        >
          {TRACKER_COLUMNS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      {open && (
        <div className="mt-2 space-y-2" {...stop}>
          <textarea
            aria-label={`Notes for ${app.company}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== app.notes && onSave({ notes })}
            placeholder="Recruiter name, referral, what they asked…"
            className="min-h-[72px] w-full rounded-md border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/60 focus:outline-none"
          />
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Follow up on
            <input
              type="date"
              value={app.followUpAt ?? ""}
              onChange={(e) => onSave({ followUpAt: e.target.value || null })}
              className="rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-xs text-slate-200 [color-scheme:dark]"
            />
          </label>
        </div>
      )}
    </div>
  )
}
