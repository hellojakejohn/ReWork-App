"use client"

// Home: where returning users land and where "Done" on the Result card goes. One look at
// the resume in use, the recent jobs (with their tracker status) and the next action.
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { ArrowRight, Check, KanbanSquare, Mail, Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { TRACKER_COLUMNS, columnOf, trackerStats, type TrackerColumn } from "@/lib/tracker"
import { summarizeResume } from "@/lib/master-resume"
import { dueLine, followUpDue } from "@/lib/follow-up"
import { FollowUpDialog } from "@/components/tracker/follow-up-dialog"
import { loadTracker, renameMaster, updateTracked, type ApplicationSummaryDTO, type JobDraft, type MasterResumeDTO, type Quota, type TrackerCardDTO } from "./api"
import { Card } from "./ui"
import { MatchesPanel } from "./matches-panel"

const RECENT = 5

export function HomeCard({
  active,
  applications,
  quota,
  isActiveStep,
  onNewJob,
  onOpenResume,
  onAddResume,
  onRenamed,
  masters,
  onOpenApplication,
  onOpenRecent,
  onPickMatch,
  onUpgrade,
}: {
  active: MasterResumeDTO | null
  masters: MasterResumeDTO[]
  applications: ApplicationSummaryDTO[]
  quota: Quota | null
  isActiveStep: boolean
  onNewJob: () => void
  onOpenResume: (id: string) => void
  onAddResume: () => void
  onRenamed: (master: MasterResumeDTO) => void
  onOpenApplication: (id: string) => void
  onOpenRecent: () => void
  onPickMatch: (job: JobDraft) => void
  onUpgrade: (reason?: string) => void
}) {
  const { data: session } = useSession()
  const firstName = session?.user?.name?.trim().split(/\s+/)[0] ?? ""
  const [tracked, setTracked] = useState<TrackerCardDTO[] | null>(null)
  const [marking, setMarking] = useState<string | null>(null)

  // Fresh tracker numbers every time Home is shown (a tailor or a tracker move may have happened).
  useEffect(() => {
    if (!isActiveStep) return
    let live = true
    void loadTracker().then((r) => {
      if (live && r.ok) setTracked(r.applications)
    })
    return () => {
      live = false
    }
  }, [isActiveStep])

  const stats = useMemo(() => (tracked ? trackerStats(tracked) : null), [tracked])
  const byId = useMemo(() => new Map((tracked ?? []).map((t) => [t.id, t])), [tracked])
  // Jobs due a check-in email, longest-waiting first.
  const followUps = useMemo(
    () =>
      (tracked ?? [])
        .map((app) => ({ app, due: followUpDue(app) }))
        .filter((f): f is { app: TrackerCardDTO; due: NonNullable<ReturnType<typeof followUpDue>> } => !!f.due)
        .sort((a, b) => b.due.days - a.due.days),
    [tracked]
  )
  const [writing, setWriting] = useState<TrackerCardDTO | null>(null)
  const recent = applications.slice(0, RECENT)
  const shown = masters.filter((m) => !m.hidden || m.id === active?.id)

  const snooze = async (id: string, followUpAt: string) => {
    const r = await updateTracked(id, { followUpAt })
    if (!r.ok) {
      toast.error(r.error)
      return false
    }
    setTracked((list) => (list ? list.map((t) => (t.id === id ? r.application : t)) : list))
    return true
  }

  const markApplied = async (id: string) => {
    setMarking(id)
    const r = await updateTracked(id, { column: "applied" })
    setMarking(null)
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    setTracked((list) => (list ? list.map((t) => (t.id === id ? r.application : t)) : list))
    toast.success("Marked as applied")
  }

  const tailorsLeft = quota && quota.limit !== null ? `${quota.remaining} of ${quota.limit} free tailors left this month` : null

  return (
    <Card>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 sm:p-8">
        <div className="space-y-2">
          <h2 className="font-serif text-3xl font-medium leading-tight tracking-tight text-text sm:text-4xl">
            Welcome back{firstName ? `, ${firstName}` : ""}.
          </h2>
          <p className="text-sm text-text-muted">
            Pick a job that fits you, or paste one you found, and get a tailored resume in about a minute.{tailorsLeft ? ` ${tailorsLeft}.` : ""}
          </p>
        </div>

        <Button className="h-12 w-full text-base" onClick={onNewJob}>
          Find a job to tailor for <ArrowRight className="h-4 w-4" />
        </Button>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Stat label="Tailored" value={applications.length} />
          <Stat label="Applied this week" value={stats?.appliedThisWeek} />
          <Stat label="Interviews" value={stats?.interviews} />
        </div>

        {active && isActiveStep && <MatchesPanel compact resumeId={active.id} home={active.resume.contact.location} onPick={onPickMatch} onUpgrade={onUpgrade} onSeeAll={onNewJob} />}

        {followUps.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-text">
              Follow up <span className="ml-1 rounded-full bg-warn-tint px-1.5 text-xs text-text">{followUps.length}</span>
            </h3>
            <ul className="divide-y divide-border rounded-card border border-border">
              {followUps.slice(0, 3).map(({ app, due }) => (
                <li key={app.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">
                      {app.company} <span className="font-normal text-text-muted">· {app.jobTitle}</span>
                    </p>
                    <p className="truncate text-xs text-text-muted">{dueLine(due)}</p>
                  </div>
                  <Button size="sm" onClick={() => setWriting(app)}>
                    <Mail className="h-3 w-3" /> Write it
                  </Button>
                </li>
              ))}
            </ul>
            {followUps.length > 3 && (
              <Link href="/dashboard/tracker" className="text-xs font-semibold text-text-muted hover:text-text">
                {followUps.length - 3} more on your tracker
              </Link>
            )}
            {writing && <FollowUpDialog app={writing} open onClose={() => setWriting(null)} onSnooze={(date) => snooze(writing.id, date)} />}
          </section>
        )}

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-text">{shown.length > 1 ? "Your resumes" : "Your resume"}</h3>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {shown.map((m) => (
              <ResumeTile key={m.id} master={m} active={m.id === active?.id} onOpen={() => onOpenResume(m.id)} onRenamed={onRenamed} />
            ))}
            <button
              onClick={onAddResume}
              className="flex min-h-[8.5rem] flex-col items-center justify-center gap-1.5 rounded-card border border-dashed border-border p-4 text-sm text-text-muted hover:bg-surface-raised hover:text-text"
            >
              <Plus className="h-5 w-5" />
              Add a resume
              <span className="text-xs">e.g. one per kind of job</span>
            </button>
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Recent jobs</h3>
            <Link href="/dashboard/tracker" className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text">
              <KanbanSquare className="h-3.5 w-3.5" /> Open tracker
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="rounded-card border border-dashed border-border p-4 text-sm text-text-muted">Your tailored jobs will show up here.</p>
          ) : (
            <ul className="divide-y divide-border rounded-card border border-border">
              {recent.map((a) => {
                const card = byId.get(a.id)
                const column = card ? columnOf(card.status) : undefined
                return (
                  <li key={a.id} className="flex items-center gap-2 pr-3">
                    <button onClick={() => onOpenApplication(a.id)} className="min-w-0 flex-1 rounded-card px-4 py-3 text-left hover:bg-surface-raised">
                      <p className="truncate text-sm font-medium text-text">{a.jobTitle}</p>
                      <p className="truncate text-xs text-text-muted">
                        {a.company}
                        {a.coverageAfter !== null && (
                          <>
                            {" · "}
                            <span className="text-success">{a.coverageAfter}%</span> match
                          </>
                        )}
                        {card?.pay && ` · ${card.pay}`}
                      </p>
                    </button>
                    {column === "saved" ? (
                      <Button variant="secondary" size="sm" loading={marking === a.id} onClick={() => void markApplied(a.id)} title="Move to Applied in your tracker">
                        {marking !== a.id && <Check className="h-3 w-3" />} Applied
                      </Button>
                    ) : column ? (
                      <StatusChip column={column} />
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
          {applications.length > RECENT && (
            <Button variant="text" size="sm" onClick={onOpenRecent}>
              See all {applications.length}
            </Button>
          )}
        </section>
      </div>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-card bg-surface-raised p-3 sm:p-4">
      <p className="font-serif text-2xl text-text sm:text-3xl">{value ?? "-"}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  )
}

function StatusChip({ column }: { column: TrackerColumn }) {
  const label = TRACKER_COLUMNS.find((c) => c.id === column)?.label ?? ""
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        column === "interview" || column === "offer" ? "bg-success-tint text-text" : column === "rejected" ? "bg-removed text-text" : "bg-surface-raised text-text-secondary"
      )}
    >
      {label}
    </span>
  )
}

/** One resume as a square-ish card: its label (renamable), headline, top skills. */
function ResumeTile({
  master,
  active,
  onOpen,
  onRenamed,
}: {
  master: MasterResumeDTO
  active: boolean
  onOpen: () => void
  onRenamed: (master: MasterResumeDTO) => void
}) {
  const s = summarizeResume(master.resume)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(master.title)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const title = name.trim()
    if (!title || title === master.title) {
      setName(master.title)
      setEditing(false)
      return
    }
    setSaving(true)
    const r = await renameMaster(master.id, title)
    setSaving(false)
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    onRenamed(r.master)
    setEditing(false)
  }

  return (
    <div className={cn("relative flex min-h-[8.5rem] flex-col rounded-card border p-4", active ? "border-accent" : "border-border")}>
      <div className="relative z-10 flex items-start gap-1">
        {editing ? (
          <input
            autoFocus
            value={name}
            maxLength={60}
            disabled={saving}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void save()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save()
              if (e.key === "Escape") {
                e.preventDefault()
                setName(master.title)
                setEditing(false)
              }
            }}
            aria-label="Resume name"
            className="w-full min-w-0 rounded-input border border-input bg-surface px-2 py-0.5 text-sm font-semibold text-text"
          />
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate rounded-full bg-surface-raised px-2.5 py-0.5 text-xs font-semibold text-text" title={master.title}>
              {master.title}
            </span>
            <button
              onClick={() => setEditing(true)}
              className="shrink-0 rounded-full p-1 text-text-muted hover:bg-surface-raised hover:text-text"
              aria-label={`Rename ${master.title}`}
              title="Rename"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
      <button onClick={onOpen} className="mt-3 flex flex-1 flex-col items-start text-left after:absolute after:inset-0 after:rounded-card after:content-['']">
        <span className="line-clamp-2 text-sm font-medium text-text">{s.headline || s.name || "Resume"}</span>
        {s.topSkills.length > 0 && <span className="mt-1 line-clamp-2 text-xs text-text-muted">{s.topSkills.slice(0, 3).join(" · ")}</span>}
        <span className="mt-auto pt-2 text-xs text-text-faint">{active ? "In use" : `Updated ${new Date(master.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}</span>
      </button>
    </div>
  )
}
