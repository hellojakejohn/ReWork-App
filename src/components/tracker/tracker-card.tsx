"use client"

// One application on the tracker: what it is, where it stands, links back into the flow,
// downloads, notes and a follow-up date.
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import Link from "next/link"
import { CalendarClock, ChevronDown, Download, ExternalLink, FileText, MoreHorizontal, StickyNote, Trash2, Wand2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { TRACKER_COLUMNS, columnOf, type TrackerColumn } from "@/lib/tracker"
import type { TemplateId } from "@/lib/resume-templates"
import { WORD_EXPORT_UPSELL } from "@/lib/plans"
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
  isPro,
  onUpgrade,
}: {
  isPro: boolean
  onUpgrade: (reason: string) => void
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
  const menuItem = "cursor-pointer text-text focus:bg-surface-raised focus:text-text"
  const word = (href: string, text: string) =>
    isPro ? (
      <DropdownMenuItem asChild className={menuItem}>
        <a href={href}><Download className="mr-2 h-4 w-4" /> {text}</a>
      </DropdownMenuItem>
    ) : (
      <DropdownMenuItem className={menuItem} onSelect={() => onUpgrade(WORD_EXPORT_UPSELL)}>
        <Download className="mr-2 h-4 w-4" /> {text}
        <span className="ml-auto rounded-full bg-sage px-1.5 text-xs font-semibold text-text">Pro</span>
      </DropdownMenuItem>
    )
  // Links inside a draggable card: don't let a click start a drag.
  const stop = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation(), onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation() }

  return (
    <div className={cn("rounded-card border border-border bg-surface p-3 text-sm shadow-sm", dragging && "opacity-40")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-text">{app.company}</p>
          <p className="truncate text-xs text-text-muted">{app.jobTitle}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger {...stop} className="rounded-md p-1 text-text-muted hover:bg-surface-raised hover:text-text" aria-label={`More for ${app.company}`}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 border-border bg-surface text-text">
            {app.tailored ? (
              <>
                <DropdownMenuLabel className="text-xs font-normal text-text-muted">PDF for humans, Word for application portals.</DropdownMenuLabel>
                <DropdownMenuItem asChild className={menuItem}>
                  <a href={resume}><FileText className="mr-2 h-4 w-4" /> Resume PDF</a>
                </DropdownMenuItem>
                {word(`${resume}&format=docx`, "Resume Word")}
                {app.hasCoverLetter && (
                  <>
                    <DropdownMenuItem asChild className={menuItem}>
                      <a href={`${letter}&format=pdf`}><FileText className="mr-2 h-4 w-4" /> Cover letter PDF</a>
                    </DropdownMenuItem>
                    {word(`${letter}&format=docx`, "Cover letter Word")}
                  </>
                )}
                <DropdownMenuSeparator className="bg-surface-raised" />
              </>
            ) : null}
            <DropdownMenuItem onSelect={onDelete} className="cursor-pointer text-accent-strong focus:bg-removed focus:text-accent-strong">
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
        <span>{statusLine(app)}</span>
        {app.coverageAfter !== null && app.tailored && (
          <span>
            · <span className="text-success">{app.coverageAfter}%</span> keywords
          </span>
        )}
        {app.followUpAt && (
          <span className={cn("flex items-center gap-1", due ? "text-warn" : "")}>
            · <CalendarClock className="h-3 w-3" /> {due ? "Follow up" : "Follow-up"} {day(`${app.followUpAt}T12:00:00`)}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs" {...stop}>
        {app.tailored ? (
          <Button asChild variant="secondary" size="sm" className="h-7 px-2.5">
            <Link href={`/dashboard?application=${app.id}`}>Open result</Link>
          </Button>
        ) : (
          <Button asChild size="sm" className="h-7 px-2.5">
            <Link href={`/dashboard?tailor=${app.id}`}>
              <Wand2 className="h-3 w-3" /> Tailor for it
            </Link>
          </Button>
        )}
        {app.jobUrl && (
          <a href={app.jobUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-full px-2 py-1 text-text-muted hover:bg-surface-raised hover:text-text">
            Posting <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <Button
          variant="text"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cn("ml-auto h-7 px-2", app.notes && "text-text")}
        >
          <StickyNote className="h-3 w-3" /> Notes <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </Button>
      </div>

      {/* Status on small screens, where dragging between columns isn't practical. */}
      <label className="mt-2 block md:hidden" {...stop}>
        <span className="sr-only">Status</span>
        <select
          value={columnOf(app.status)}
          onChange={(e) => onMove(e.target.value as TrackerColumn)}
          className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-text"
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
            className="min-h-[72px] w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-text placeholder:text-text-muted focus:border-text focus:outline-none"
          />
          <label className="flex items-center gap-2 text-xs text-text-muted">
            Follow up on
            <input
              type="date"
              value={app.followUpAt ?? ""}
              onChange={(e) => onSave({ followUpAt: e.target.value || null })}
              className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-text [color-scheme:dark]"
            />
          </label>
        </div>
      )}
    </div>
  )
}
