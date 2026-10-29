"use client"

import { Button } from "@/components/ui/button"
import { useState } from "react"
import { ArrowDown, ArrowRight, Briefcase, FileText, Sparkles } from "lucide-react"
import { summarizeResume } from "@/lib/master-resume"
import { FREE_TAILORS_PER_MONTH } from "@/lib/plans"
import { runTailor, type ApplicationDetailDTO, type JobDraft, type MasterResumeDTO, type Quota } from "./api"
import { Card, CardBody, CardFooter, CardHeader, ErrorNote, StageList } from "./ui"
import { useAdvance } from "./use-advance"
import { FitSummary, SkillCheck, useFit } from "./skill-check"

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
  onReplaceResume,
  onMasterSaved,
}: {
  master: MasterResumeDTO | null
  job: JobDraft | null
  quota: Quota | null
  isActiveStep: boolean
  onBack: () => void
  onDone: (application: ApplicationDetailDTO, tailorsRemaining: number | null) => void
  onUpgrade: (reason?: string) => void
  onReplaceResume: () => void
  onMasterSaved: (master: MasterResumeDTO) => void
}) {
  const [stage, setStage] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [limitHit, setLimitHit] = useState(false)
  const [checking, setChecking] = useState(false)
  const [added, setAdded] = useState(0)
  const running = stage !== null
  const outOfTailors = limitHit || (quota?.remaining === 0 && quota.limit !== null)
  const ready = !!master && !!job && !running && !outOfTailors && !checking
  const { fit, loading: fitLoading, failed: fitFailed, update: updateFit } = useFit(master, job, isActiveStep)

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
        {checking && master && fit ? (
          <SkillCheck
            master={master}
            fit={fit}
            onClose={() => setChecking(false)}
            onSaved={(m, coverage, applied) => {
              onMasterSaved(m)
              updateFit(coverage)
              setAdded(applied)
              setChecking(false)
            }}
          />
        ) : (
          <>
            {/* One resume going to one job: an arrow between, not two cards side by side. */}
            <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
              <div className="rounded-card border border-border bg-surface-raised p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
                  <FileText className="h-3.5 w-3.5" /> Your resume
                </p>
                {s ? (
                  <>
                    <p className="font-semibold text-text">{s.name || master!.title}</p>
                    <p className="text-sm text-text-muted">{s.headline}</p>
                    <p className="mt-1 flex items-center justify-between gap-2 text-xs text-text-muted">
                      <span>
                        {s.roles} {s.roles === 1 ? "role" : "roles"} · {s.projects} {s.projects === 1 ? "project" : "projects"}
                      </span>
                      {!running && (
                        <Button variant="text" size="sm" className="-mr-2 h-auto py-0.5 underline underline-offset-4" onClick={onReplaceResume}>
                          Replace
                        </Button>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-text-muted">No resume yet</p>
                )}
              </div>
              <div className="flex justify-center text-text-muted" aria-hidden>
                <ArrowDown className="h-5 w-5 sm:hidden" />
                <ArrowRight className="hidden h-5 w-5 sm:block" />
              </div>
              <div className="rounded-card border border-border bg-surface-raised p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
                  <Briefcase className="h-3.5 w-3.5" /> Tailored for this job
                </p>
                {job ? (
                  <>
                    <p className="font-semibold text-text">{job.title}</p>
                    <p className="text-sm text-text-muted">{job.company}</p>
                    {job.location && <p className="mt-1 text-xs text-text-muted">{job.location}</p>}
                  </>
                ) : (
                  <p className="text-sm text-text-muted">No job yet</p>
                )}
              </div>
            </div>

            {!running && !outOfTailors && (
              <>
                {added > 0 && (
                  <p className="rounded-input bg-success-tint px-3 py-2 text-sm text-text" role="status">
                    Added {added} to your resume. The tailor will use {added === 1 ? "it" : "them"}.
                  </p>
                )}
                <FitSummary fit={fit} loading={fitLoading} failed={fitFailed} onCheck={() => setChecking(true)} />
              </>
            )}
          </>
        )}

        {checking ? null : running ? (
          <div className="rounded-card border border-border bg-surface-raised p-4">
            <StageList stages={TAILOR_STAGES} current={stage} />
          </div>
        ) : outOfTailors ? (
          <div className="space-y-3 rounded-card bg-surface-raised p-4 text-sm">
            <p className="text-text">
              You&apos;ve used all {quota?.limit ?? FREE_TAILORS_PER_MONTH} free tailors this month. Your resume and past results stay here.
            </p>
            <Button onClick={() => onUpgrade()}>
              <Sparkles className="h-4 w-4" /> Tailor every job with Pro
            </Button>
          </div>
        ) : (
          error && <ErrorNote>{error}</ErrorNote>
        )}
      </CardBody>
      <CardFooter>
        <span className="mr-auto text-xs text-text-muted">
          {quota?.limit === null ? "Pro: tailor every job you apply to" : quota ? `${quota.remaining} of ${quota.limit} free tailors left this month` : ""}
        </span>
        {!running && error && !outOfTailors && <Button variant="secondary" onClick={() => void tailor()}>Try again</Button>}
        <Button size="lg" loading={running} disabled={!ready} onClick={() => void tailor()}>
          <Sparkles className="h-4 w-4" /> Tailor
        </Button>
      </CardFooter>
    </Card>
  )
}
