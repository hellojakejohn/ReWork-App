"use client"

// /dashboard/tracker: every application on a board. Drag between columns on desktop, a
// status dropdown on small screens. Moves are optimistic and roll back on failure.
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Plus, Sparkles } from "lucide-react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import { TRACKER_COLUMNS, columnOf, trackerStats, transitionPatch, type TrackerColumn } from "@/lib/tracker"
import { FREE_TRACKER_APPLICATIONS } from "@/lib/plans"
import type { TemplateId } from "@/lib/resume-templates"
import { UpgradeSheet } from "@/components/billing/upgrade-sheet"
import { AppHeader } from "@/components/flow/app-header"
import { deleteTracked, loadTracker, updateTracked, type TrackerCardDTO, type TrackerData } from "@/components/flow/api"
import { ErrorNote, PrimaryButton, SecondaryButton } from "@/components/flow/ui"
import { TrackerCard } from "./tracker-card"
import { AddJobDialog } from "./add-job-dialog"

function readTemplate(): TemplateId {
  try {
    return window.localStorage.getItem("rework.template") === "modern" ? "modern" : "classic"
  } catch {
    return "classic"
  }
}

function DraggableCard(props: React.ComponentProps<typeof TrackerCard>) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.app.id })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} aria-roledescription="Draggable application" className="cursor-grab touch-none active:cursor-grabbing">
      <TrackerCard {...props} dragging={isDragging} />
    </div>
  )
}

function Column({ id, label, count, children }: { id: TrackerColumn; label: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={cn("flex min-h-0 w-full flex-col rounded-2xl border bg-slate-900/40 transition-colors", isOver ? "border-emerald-400/50 bg-emerald-500/5" : "border-white/5")}
    >
      <h2 className="flex items-center justify-between px-3 pb-2 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-400">{count}</span>
      </h2>
      <div className="min-h-[120px] flex-1 space-y-2 overflow-y-auto px-2 pb-2">{children}</div>
    </section>
  )
}

export function TrackerView() {
  const [data, setData] = useState<TrackerData | null>(null)
  const [error, setError] = useState("")
  const [adding, setAdding] = useState(false)
  const [upgrade, setUpgrade] = useState<{ open: boolean; reason?: string }>({ open: false })
  const [mobileColumn, setMobileColumn] = useState<TrackerColumn>("saved")
  const [dragId, setDragId] = useState<string | null>(null)
  const [template, setTemplate] = useState<TemplateId>("classic")

  const load = useCallback(async () => {
    setError("")
    const result = await loadTracker()
    if (!result.ok) {
      setError(result.error)
      return
    }
    setData(result)
  }, [])

  useEffect(() => {
    document.title = "Tracker · ReWork"
    setTemplate(readTemplate())
    void load()
  }, [load])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor))

  const apps = useMemo(() => data?.applications ?? [], [data])
  const stats = useMemo(() => trackerStats(apps), [apps])
  const byColumn = useMemo(() => {
    const map = Object.fromEntries(TRACKER_COLUMNS.map((c) => [c.id, [] as TrackerCardDTO[]])) as Record<TrackerColumn, TrackerCardDTO[]>
    for (const app of apps) map[columnOf(app.status)].push(app)
    return map
  }, [apps])

  const replace = (app: TrackerCardDTO) =>
    setData((d) => (d ? { ...d, applications: d.applications.map((a) => (a.id === app.id ? app : a)) } : d))

  const move = async (app: TrackerCardDTO, column: TrackerColumn) => {
    const patch = transitionPatch(
      { status: app.status, tailored: app.tailored, appliedAt: app.appliedAt ? new Date(app.appliedAt) : null, responseAt: null },
      column
    )
    if (!patch) return
    // Optimistic: show it in the new column now, confirm with the server's copy.
    replace({
      ...app,
      status: patch.status,
      statusUpdatedAt: patch.statusUpdatedAt.toISOString(),
      appliedAt: patch.appliedAt ? patch.appliedAt.toISOString() : app.appliedAt,
    })
    const result = await updateTracked(app.id, { column })
    if (result.ok) replace(result.application)
    else {
      replace(app)
      toast.error(result.error)
    }
  }

  const save = async (app: TrackerCardDTO, patch: { notes?: string; followUpAt?: string | null }) => {
    replace({ ...app, ...patch })
    const result = await updateTracked(app.id, patch)
    if (result.ok) replace(result.application)
    else {
      replace(app)
      toast.error(result.error)
    }
  }

  const remove = async (app: TrackerCardDTO) => {
    const what = app.tailored ? "its tailored resume and cover letter" : "it"
    if (!confirm(`Delete ${app.jobTitle} at ${app.company}? This removes ${what} too.`)) return
    const result = await deleteTracked(app.id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setData((d) => (d ? { ...d, total: d.total - 1, applications: d.applications.filter((a) => a.id !== app.id) } : d))
  }

  const onDragEnd = (event: DragEndEvent) => {
    setDragId(null)
    const app = apps.find((a) => a.id === event.active.id)
    const column = event.over?.id as TrackerColumn | undefined
    if (app && column) void move(app, column)
  }

  const atLimit = !!data && data.limit !== null && data.total >= data.limit
  const cardProps = (app: TrackerCardDTO) => ({
    app,
    template,
    onMove: (column: TrackerColumn) => void move(app, column),
    onSave: (patch: { notes?: string; followUpAt?: string | null }) => void save(app, patch),
    onDelete: () => void remove(app),
    isPro: !!data?.isPro,
    onUpgrade: (reason: string) => setUpgrade({ open: true, reason }),
  })
  const dragged = dragId ? apps.find((a) => a.id === dragId) : null

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-950">
      <AppHeader quota={null} recentCount={0} onUpgrade={() => setUpgrade({ open: true })} flow={null} view="tracker" />

      <div className="flex shrink-0 flex-wrap items-end gap-3 px-4 pb-3 pt-4 sm:px-6">
        <div className="mr-auto">
          <h1 className="text-lg font-semibold text-slate-100">Applications</h1>
          <p className="text-sm text-slate-400">Everything you&apos;re applying to, in one place.</p>
        </div>
        <dl className="flex gap-2 text-center">
          {[
            ["Applied this week", stats.appliedThisWeek],
            ["Interviews", stats.interviews],
            ["Response rate", stats.responseRate === null ? "–" : `${stats.responseRate}%`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-1.5">
              <dd className="text-base font-semibold text-slate-100">{value}</dd>
              <dt className="text-[11px] text-slate-500">{label}</dt>
            </div>
          ))}
        </dl>
        <PrimaryButton
          onClick={() =>
            atLimit
              ? setUpgrade({ open: true, reason: `Free accounts can track up to ${FREE_TRACKER_APPLICATIONS} applications. Pro tracks every job.` })
              : setAdding(true)
          }
        >
          <Plus className="h-4 w-4" /> Add a job
        </PrimaryButton>
      </div>

      {data && data.limit !== null && data.total > data.limit && (
        <div className="mx-4 mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-sm sm:mx-6">
          <p className="flex-1 text-slate-200">
            Showing your {data.limit} newest of {data.total} applications. Pro tracks all of them.
          </p>
          <SecondaryButton className="py-1.5" onClick={() => setUpgrade({ open: true })}>
            <Sparkles className="h-3.5 w-3.5 text-emerald-300" /> Go Pro
          </SecondaryButton>
        </div>
      )}

      <main className="min-h-0 flex-1 px-3 pb-3 sm:px-6 sm:pb-6">
        {error ? (
          <div className="mx-auto max-w-sm space-y-3 pt-10 text-center">
            <ErrorNote>{error}</ErrorNote>
            <SecondaryButton onClick={() => void load()}>Try again</SecondaryButton>
          </div>
        ) : !data ? (
          <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-5">
            {TRACKER_COLUMNS.map((c) => (
              <div key={c.id} className="hidden h-64 animate-pulse rounded-2xl border border-white/5 bg-white/[0.02] md:block" />
            ))}
          </div>
        ) : apps.length === 0 ? (
          <div className="mx-auto max-w-md space-y-3 pt-12 text-center">
            <p className="text-slate-200">Nothing tracked yet.</p>
            <p className="text-sm text-slate-400">Every resume you tailor lands here as Saved. You can also add jobs you applied to elsewhere.</p>
            <div className="flex justify-center gap-2">
              <Link href="/dashboard" className="inline-flex items-center rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5">
                Tailor a resume
              </Link>
              <PrimaryButton onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> Add a job
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop: drag between columns */}
            <DndContext sensors={sensors} onDragStart={(e) => setDragId(String(e.active.id))} onDragCancel={() => setDragId(null)} onDragEnd={onDragEnd}>
              <div className="hidden h-full grid-cols-5 gap-3 md:grid">
                {TRACKER_COLUMNS.map((c) => (
                  <Column key={c.id} id={c.id} label={c.label} count={byColumn[c.id].length}>
                    {byColumn[c.id].map((app) => (
                      <DraggableCard key={app.id} {...cardProps(app)} />
                    ))}
                  </Column>
                ))}
              </div>
              <DragOverlay>{dragged ? <div className="rotate-1"><TrackerCard {...cardProps(dragged)} /></div> : null}</DragOverlay>
            </DndContext>

            {/* Small screens: one column at a time, status dropdown on each card */}
            <div className="flex h-full flex-col md:hidden">
              <div role="tablist" className="mb-2 flex shrink-0 gap-1 overflow-x-auto">
                {TRACKER_COLUMNS.map((c) => (
                  <button
                    key={c.id}
                    role="tab"
                    aria-selected={mobileColumn === c.id}
                    onClick={() => setMobileColumn(c.id)}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1 text-xs",
                      mobileColumn === c.id ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    {c.label} <span className="text-slate-500">{byColumn[c.id].length}</span>
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto" role="tabpanel">
                {byColumn[mobileColumn].length === 0 && <p className="p-4 text-center text-sm text-slate-500">Nothing here yet.</p>}
                {byColumn[mobileColumn].map((app) => (
                  <TrackerCard key={app.id} {...cardProps(app)} />
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      <AddJobDialog
        open={adding}
        onOpenChange={setAdding}
        onLimit={(reason) => setUpgrade({ open: true, reason })}
        onAdded={(app) => {
          setData((d) => (d ? { ...d, total: d.total + 1, applications: [app, ...d.applications] } : d))
          setMobileColumn("saved")
          toast.success(`${app.company} added to Saved.`)
        }}
      />
      <UpgradeSheet open={upgrade.open} onOpenChange={(open) => setUpgrade((u) => ({ ...u, open }))} reason={upgrade.reason} />
    </div>
  )
}
