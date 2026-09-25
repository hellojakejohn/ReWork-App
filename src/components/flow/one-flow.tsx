"use client"

// The whole app on one screen: Resume -> Job -> Tailor -> Result, one card at a time,
// sliding horizontally. Everything fits the viewport; long content scrolls inside its card.
//
// The cover letter and Word export live inside the Result card, the evidence interview
// inside the Resume card; the tracker is its own view at /dashboard/tracker.
import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { UpgradeSheet } from "@/components/billing/upgrade-sheet"
import { CheckoutSuccess } from "@/components/billing/checkout-success"
import { hasContent } from "@/lib/master-dto"
import type { TemplateId } from "@/lib/resume-templates"
import {
  loadApplication,
  loadDashboard,
  type ApplicationDetailDTO,
  type ApplicationSummaryDTO,
  type JobDraft,
  type MasterResumeDTO,
  type Quota,
} from "./api"
import { AppHeader } from "./app-header"
import { StepRail } from "./step-rail"
import { ResumeCard, type ResumeCardRequest } from "./resume-card"
import { ManageResumesDialog } from "./manage-resumes"
import { JobCard } from "./job-card"
import { TailorCard } from "./tailor-card"
import { ResultCard } from "./result-card"
import { RecentDrawer } from "./recent-drawer"
import { ErrorNote, SecondaryButton } from "./ui"

const TEMPLATE_KEY = "rework.template"
const ACTIVE_MASTER_KEY = "rework.activeMaster"

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // private mode etc.
  }
}

/** The remembered master, else the newest one that hasn't been replaced. */
function pickInitial(masters: MasterResumeDTO[]): MasterResumeDTO | null {
  const remembered = readStored(ACTIVE_MASTER_KEY)
  return masters.find((m) => m.id === remembered) ?? masters.find((m) => !m.hidden) ?? masters[0] ?? null
}

export function OneFlow() {
  const { update: refreshSession } = useSession()
  const [loadError, setLoadError] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [masters, setMasters] = useState<MasterResumeDTO[]>([])
  const [applications, setApplications] = useState<ApplicationSummaryDTO[]>([])
  const [quota, setQuota] = useState<Quota | null>(null)
  const [coverLetterQuota, setCoverLetterQuota] = useState<Quota | null>(null)

  const [step, setStep] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [resumeConfirmed, setResumeConfirmed] = useState(false)
  const [job, setJob] = useState<JobDraft | null>(null)
  const [application, setApplication] = useState<ApplicationDetailDTO | null>(null)
  const [template, setTemplate] = useState<TemplateId>("classic")

  const [recentOpen, setRecentOpen] = useState(false)
  const [upgrade, setUpgrade] = useState<{ open: boolean; reason?: string }>({ open: false })
  const [manageOpen, setManageOpen] = useState(false)
  const [resumeRequest, setResumeRequest] = useState<ResumeCardRequest | null>(null)

  const active = masters.find((m) => m.id === activeId) ?? null

  const load = useCallback(async () => {
    setLoadError("")
    const result = await loadDashboard()
    if (!result.ok) {
      setLoadError(result.error)
      return
    }
    setMasters(result.masters)
    setApplications(result.applications)
    setQuota(result.quota)
    setCoverLetterQuota(result.coverLetterQuota)
    const initial = pickInitial(result.masters)
    setActiveId(initial?.id ?? null)
    // Returning users with a usable master start on the Job card.
    if (initial && hasContent(initial.resume)) {
      setResumeConfirmed(true)
      setStep(1)
    }
    const stored = readStored(TEMPLATE_KEY)
    if (stored === "classic" || stored === "modern") setTemplate(stored)
    setLoaded(true)

    // Links from other views (the tracker's account menu): ?open=manage | start
    const params = new URLSearchParams(window.location.search)
    const open = params.get("open")
    if (open) {
      params.delete("open")
      const query = params.toString()
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
      if (open === "manage") setManageOpen(true)
      if (open === "start") {
        setResumeConfirmed(false)
        setStep(0)
        setResumeRequest({ mode: "new", nonce: Date.now() })
      }
    }
  }, [])

  useEffect(() => {
    document.title = "ReWork"
    void load()
  }, [load])

  const completed = [resumeConfirmed && !!active, !!job, !!application, !!application]
  const go = useCallback((target: number) => setStep(Math.max(0, Math.min(3, target))), [])

  // Esc goes back a card (unless a dialog/drawer handles it first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      if (document.querySelector('[role="dialog"]')) return
      setStep((s) => Math.max(0, s - 1))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const selectMaster = (id: string) => {
    setActiveId(id)
    writeStored(ACTIVE_MASTER_KEY, id)
    setResumeConfirmed(false)
    setApplication(null)
  }

  /** Resume card, in the given mode. The rail and "Replace resume" links land here. */
  const openResume = (mode: ResumeCardRequest["mode"]) => {
    setResumeRequest({ mode, nonce: Date.now() })
    go(0)
  }

  // Account menu -> Start over: empty dropzone, nothing deleted.
  const startOver = () => {
    setJob(null)
    setApplication(null)
    setResumeConfirmed(false)
    openResume("new")
  }

  // Header logo: back to the card a fresh load would open.
  const resetFlow = () => {
    setJob(null)
    setApplication(null)
    setRecentOpen(false)
    if (active && hasContent(active.resume)) {
      setResumeConfirmed(true)
      setResumeRequest({ mode: "summary", nonce: Date.now() })
      go(1)
    } else {
      setResumeConfirmed(false)
      openResume(active ? "summary" : "new")
    }
  }

  const upsertMaster = (master: MasterResumeDTO) => {
    setMasters((list) => [master, ...list.filter((m) => m.id !== master.id)])
    setActiveId(master.id)
    writeStored(ACTIVE_MASTER_KEY, master.id)
  }

  const removeMaster = (id: string) => {
    const rest = masters.filter((m) => m.id !== id)
    setMasters(rest)
    if (activeId === id) {
      const next = pickInitial(rest)
      setActiveId(next?.id ?? null)
      if (next) writeStored(ACTIVE_MASTER_KEY, next.id)
      setResumeConfirmed(false)
      setApplication(null)
    }
  }

  const openApplication = async (id: string) => {
    setRecentOpen(false)
    const result = await loadApplication(id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    const app = result.application
    setApplication(app)
    if (masters.some((m) => m.id === app.resumeId)) {
      setActiveId(app.resumeId)
      setResumeConfirmed(true)
    }
    setJob({ url: app.jobUrl ?? "", title: app.jobTitle, company: app.company, location: app.jobLocation, description: app.jobDescription })
    go(3)
  }

  const onTailored = (app: ApplicationDetailDTO, remaining: number | null) => {
    setApplication(app)
    setApplications((list) => [
      {
        id: app.id,
        resumeId: app.resumeId,
        jobTitle: app.jobTitle,
        company: app.company,
        jobUrl: app.jobUrl,
        createdAt: app.createdAt,
        coverageBefore: app.coverageBefore,
        coverageAfter: app.coverageAfter,
      },
      ...list.filter((a) => a.id !== app.id),
    ])
    setQuota((q) => (q ? { ...q, used: q.used + 1, remaining: remaining ?? q.remaining } : q))
    void refreshSession()
    go(3)
  }

  const chooseTemplate = (id: TemplateId) => {
    setTemplate(id)
    writeStored(TEMPLATE_KEY, id)
  }

  if (!loaded) {
    return (
      <div className="flex h-[100dvh] flex-col bg-slate-950">
        <AppHeader quota={null} recentCount={0} onOpenRecent={() => {}} onUpgrade={() => {}} flow={null} />
        <div className="flex flex-1 items-center justify-center p-4">
          {loadError ? (
            <div className="w-full max-w-sm space-y-3 text-center">
              <ErrorNote>{loadError}</ErrorNote>
              <SecondaryButton onClick={() => void load()}>Try again</SecondaryButton>
            </div>
          ) : (
            <div className="h-64 w-full max-w-2xl animate-pulse rounded-2xl border border-white/5 bg-white/[0.02]" />
          )}
        </div>
      </div>
    )
  }

  const cards = [
    <ResumeCard
      key="resume"
      active={active}
      masters={masters}
      isActiveStep={step === 0}
      onParsed={(m, replacedId) => {
        upsertMaster(m)
        if (replacedId) setMasters((list) => list.map((x) => (x.id === replacedId ? { ...x, hidden: true } : x)))
        setResumeConfirmed(false)
        setApplication(null) // the old result belongs to a different resume
      }}
      onSaved={upsertMaster}
      onSelect={selectMaster}
      onDeleted={removeMaster}
      onConfirm={() => {
        setResumeConfirmed(true)
        go(1)
      }}
      onLimit={(reason) => setUpgrade({ open: true, reason })}
      request={resumeRequest}
    />,
    <JobCard
      key="job"
      job={job}
      isActiveStep={step === 1}
      onBack={() => go(0)}
      onConfirm={(j) => {
        setJob(j)
        go(2)
      }}
    />,
    <TailorCard
      key="tailor"
      master={resumeConfirmed ? active : null}
      job={job}
      quota={quota}
      isActiveStep={step === 2}
      onBack={() => go(1)}
      onDone={onTailored}
      onUpgrade={(reason) => setUpgrade({ open: true, reason })}
      onReplaceResume={() => openResume("replace")}
    />,
    <ResultCard
      key="result"
      application={application}
      template={template}
      onTemplate={chooseTemplate}
      onChange={setApplication}
      onBack={() => go(2)}
      onAnotherJob={() => {
        setJob(null)
        setApplication(null)
        go(1)
      }}
      coverLetterQuota={coverLetterQuota}
      onCoverLetterQuota={setCoverLetterQuota}
      onUpgrade={(reason) => setUpgrade({ open: true, reason })}
    />,
  ]

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-950">
      <CheckoutSuccess />
      <AppHeader
        quota={quota}
        recentCount={applications.length}
        onOpenRecent={() => setRecentOpen(true)}
        onUpgrade={() => setUpgrade({ open: true })}
        flow={{ onLogo: resetFlow, onManageResumes: () => setManageOpen(true), onStartOver: startOver }}
      />
      <StepRail current={step} completed={completed} onSelect={(i) => (i === 0 ? openResume("summary") : go(i))} />
      <main className="relative min-h-0 flex-1 overflow-clip">
        <div
          className="flex h-full transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${step * 100}%)` }}
        >
          {cards.map((card, i) => (
            <section
              key={i}
              aria-hidden={i !== step}
              inert={i !== step}
              className="flex h-full w-full shrink-0 justify-center overflow-clip px-3 pb-3 sm:px-6 sm:pb-6"
            >
              {card}
            </section>
          ))}
        </div>
      </main>
      <RecentDrawer
        open={recentOpen}
        applications={applications}
        activeId={application?.id ?? null}
        onClose={() => setRecentOpen(false)}
        onOpen={(id) => void openApplication(id)}
      />
      <ManageResumesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        masters={masters}
        activeId={activeId}
        onActivate={(m) => {
          setMasters((list) => [m, ...list.filter((x) => x.id !== m.id)])
          selectMaster(m.id)
          setManageOpen(false)
          openResume("summary")
        }}
        onDeleted={removeMaster}
      />
      <UpgradeSheet open={upgrade.open} onOpenChange={(open) => setUpgrade((u) => ({ ...u, open }))} reason={upgrade.reason} />
    </div>
  )
}
