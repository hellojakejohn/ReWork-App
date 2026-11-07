"use client"

// Home: where returning users land and where "Done" on the Result card goes. One look at
// the resume in use, the recent jobs (with their tracker status) and the next action.
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { ArrowRight, Check, FileText, KanbanSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { TRACKER_COLUMNS, columnOf, trackerStats, type TrackerColumn } from "@/lib/tracker"
import { loadTracker, updateTracked, type ApplicationSummaryDTO, type MasterResumeDTO, type Quota, type TrackerCardDTO } from "./api"
import { Card } from "./ui"

const RECENT = 5

export function HomeCard({
  active,
  applications,
  quota,
  isActiveStep,
  onNewJob,
  onOpenResume,
  onOpenApplication,
  onOpenRecent,
}: {
  active: MasterResumeDTO | null
  applications: ApplicationSummaryDTO[]
  quota: Quota | null
  isActiveStep: boolean
  onNewJob: () => void
  onOpenResume: () => void
  onOpenApplication: (id: string) => void
  onOpenRecent: () => void
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
  const statusOf = useMemo(() => new Map((tracked ?? []).map((t) => [t.id, columnOf(t.status)])), [tracked])
  const recent = applications.slice(0, RECENT)

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
            Paste a job link and get a tailored resume in about a minute.{tailorsLeft ? ` ${tailorsLeft}.` : ""}
          </p>
        </div>

        <Button className="h-12 w-full text-base" onClick={onNewJob}>
          Tailor for a new job <ArrowRight className="h-4 w-4" />
        </Button>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Stat label="Tailored" value={applications.length} />
          <Stat label="Applied this week" value={stats?.appliedThisWeek} />
          <Stat label="Interviews" value={stats?.interviews} />
        </div>

        {active && (
          <section className="flex items-center gap-3 rounded-card border border-border p-4">
            <FileText className="h-5 w-5 shrink-0 text-text-muted" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-text-muted">Your resume</p>
              <p className="truncate text-sm font-medium text-text">{active.resume.contact?.fullName || active.title}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={onOpenResume}>
              View
            </Button>
          </section>
        )}

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
                const column = statusOf.get(a.id)
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
