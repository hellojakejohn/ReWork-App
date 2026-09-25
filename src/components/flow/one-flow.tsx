"use client"

// The whole app on one screen: Resume -> Job -> Tailor -> Result, one card at a time,
// sliding horizontally. Everything fits the viewport; long content scrolls inside its card.
//
// Seams for later (out of scope now): a cover letter or evidence interview would be
// another card after Tailor; an application tracker reads the same Recent list.
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
import { ResumeCard } from "./resume-card"
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

export function OneFlow() {
  const { update: refreshSession } = useSession()
  const [loadError, setLoadError] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [masters, setMasters] = useState<MasterResumeDTO[]>([])
  const [applications, setApplications] = useState<ApplicationSummaryDTO[]>([])
  const [quota, setQuota] = useState<Quota | null>(null)

  const [step, setStep] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [resumeConfirmed, setResumeConfirmed] = useState(false)
  const [job, setJob] = useState<JobDraft | null>(null)
  const [application, setApplication] = useState<ApplicationDetailDTO | null>(null)
  const [template, setTemplate] = useState<TemplateId>("classic")

  const [recentOpen, setRecentOpen] = useState(false)
  const [upgrade, setUpgrade] = useState<{ open: boolean; reason?: string }>({ open: false })

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
    const remembered = readStored(ACTIVE_MASTER_KEY)
    const initial = result.masters.find((m) => m.id === remembered) ?? result.masters[0] ?? null
    setActiveId(initial?.id ?? null)
    // Returning users with a usable master start on the Job card.
    if (initial && hasContent(initial.resume)) {
      setResumeConfirmed(true)
      setStep(1)
    }
    const stored = readStored(TEMPLATE_KEY)
    if (stored === "classic" || stored === "modern") setTemplate(stored)
    setLoaded(true)
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

  const upsertMaster = (master: MasterResumeDTO) => {
    setMasters((list) => [master, ...list.filter((m) => m.id !== master.id)])
    setActiveId(master.id)
    writeStored(ACTIVE_MASTER_KEY, master.id)
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
        <AppHeader quota={null} recentCount={0} onOpenRecent={() => {}} onUpgrade={() => {}} />
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
      onParsed={(m) => {
        upsertMaster(m)
        setResumeConfirmed(false)
      }}
      onSaved={upsertMaster}
      onSelect={selectMaster}
      onDeleted={(id) => {
        const rest = masters.filter((m) => m.id !== id)
        setMasters(rest)
        if (activeId === id) {
          setActiveId(rest[0]?.id ?? null)
          setResumeConfirmed(false)
        }
      }}
      onConfirm={() => {
        setResumeConfirmed(true)
        go(1)
      }}
      onLimit={(reason) => setUpgrade({ open: true, reason })}
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
      />
      <StepRail current={step} completed={completed} onSelect={go} />
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className="flex h-full transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${step * 100}%)` }}
        >
          {cards.map((card, i) => (
            <section
              key={i}
              aria-hidden={i !== step}
              inert={i !== step}
              className="flex h-full w-full shrink-0 justify-center px-3 pb-3 sm:px-6 sm:pb-6"
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
      <UpgradeSheet open={upgrade.open} onOpenChange={(open) => setUpgrade((u) => ({ ...u, open }))} reason={upgrade.reason} />
    </div>
  )
}
