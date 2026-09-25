"use client"

import { useState } from "react"
import { Briefcase, FileText, Sparkles } from "lucide-react"
import { summarizeResume } from "@/lib/master-resume"
import { FREE_TAILORS_PER_MONTH } from "@/lib/plans"
import { runTailor, type ApplicationDetailDTO, type JobDraft, type MasterResumeDTO, type Quota } from "./api"
import { Card, CardBody, CardFooter, CardHeader, ErrorNote, PrimaryButton, SecondaryButton, StageList } from "./ui"
import { useAdvance } from "./use-advance"

const TAILOR_STAGES = [
  { id: "reading", label: "Reading the job" },
  { id: "rewriting", label: "Rewriting your bullets for this job" },
  { id: "checking", label: "Fact-checking against your resume" },
  { id: "saving", label: "Saving" },
]

export function TailorCard({
  master,
  job,
  quota,
  isActiveStep,
  onBack,
  onDone,
  onUpgrade,
}: {
  master: MasterResumeDTO | null
  job: JobDraft | null
  quota: Quota | null
  isActiveStep: boolean
  onBack: () => void
  onDone: (application: ApplicationDetailDTO, tailorsRemaining: number | null) => void
  onUpgrade: (reason?: string) => void
}) {
  const [stage, setStage] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [limitHit, setLimitHit] = useState(false)
  const running = stage !== null
  const outOfTailors = limitHit || (quota?.remaining === 0 && quota.limit !== null)
  const ready = !!master && !!job && !running && !outOfTailors

  const tailor = async () => {
    if (!master || !job) return
    setError("")
    setStage("reading")
    const result = await runTailor(master.id, job, setStage)
    setStage(null)
    if (!result.ok) {
      if (result.status === 402 || result.upgradeRequired) {
        setLimitHit(true)
        onUpgrade(result.error)
      }
      setError(result.error)
      return
    }
    onDone(result.result.application, result.result.tailorsRemaining)
  }

  useAdvance(isActiveStep && ready, () => void tailor())

  const s = master ? summarizeResume(master.resume) : null
  return (
    <Card>
      <CardHeader title="Tailor" subtitle="We rewrite your bullets for this job, using only what's in your resume." onBack={running ? undefined : onBack} />
      <CardBody className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
              <FileText className="h-3.5 w-3.5" /> Resume
            </p>
            {s ? (
              <>
                <p className="font-semibold text-slate-100">{s.name || master!.title}</p>
                <p className="text-sm text-slate-400">{s.headline}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {s.roles} roles · {s.projects} projects
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">No resume yet</p>
            )}
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
              <Briefcase className="h-3.5 w-3.5" /> Job
            </p>
            {job ? (
              <>
                <p className="font-semibold text-slate-100">{job.title}</p>
                <p className="text-sm text-slate-400">{job.company}</p>
                {job.location && <p className="mt-1 text-xs text-slate-500">{job.location}</p>}
              </>
            ) : (
              <p className="text-sm text-slate-500">No job yet</p>
            )}
          </div>
        </div>

        {running ? (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <StageList stages={TAILOR_STAGES} current={stage} />
          </div>
        ) : outOfTailors ? (
          <div className="space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
            <p className="text-slate-200">
              You&apos;ve used all {quota?.limit ?? FREE_TAILORS_PER_MONTH} free tailors this month. Your resume and past results stay here.
            </p>
            <PrimaryButton onClick={() => onUpgrade()}>
              <Sparkles className="h-4 w-4" /> Get unlimited tailoring
            </PrimaryButton>
          </div>
        ) : (
          error && <ErrorNote>{error}</ErrorNote>
        )}
      </CardBody>
      <CardFooter>
        <span className="mr-auto text-xs text-slate-400">
          {quota?.limit === null ? "Unlimited tailoring" : quota ? `${quota.remaining} of ${quota.limit} free tailors left this month` : ""}
        </span>
        {!running && error && !outOfTailors && <SecondaryButton onClick={() => void tailor()}>Try again</SecondaryButton>}
        <PrimaryButton className="px-6 py-2.5 text-base" loading={running} disabled={!ready} onClick={() => void tailor()}>
          <Sparkles className="h-4 w-4" /> Tailor
        </PrimaryButton>
      </CardFooter>
    </Card>
  )
}
