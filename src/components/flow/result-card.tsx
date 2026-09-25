"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, ArrowRight, Check, RotateCcw, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { TEMPLATES, type TemplateId } from "@/lib/resume-templates"
import type { FactGuardWarning } from "@/types/tailor"
import { decideChange, type ApplicationDetailDTO, type Quota } from "./api"
import { ResumeDocument } from "./resume-document"
import { CoverLetterPanel } from "./cover-letter-panel"
import { DownloadMenu } from "./download-menu"
import { Card, CardHeader, ErrorNote, SecondaryButton } from "./ui"

type Tab = "preview" | "changes" | "keywords" | "warnings" | "letter"

const WARNING_LABEL: Record<FactGuardWarning["type"], string> = {
  fact_restored: "Fact restored",
  entry_restored: "Entry restored",
  entry_discarded: "Invented entry removed",
  new_number: "New number removed",
  skill_dropped: "Skill removed",
}

export function ResultCard({
  application,
  template,
  onTemplate,
  onChange,
  onBack,
  onAnotherJob,
  coverLetterQuota,
  onCoverLetterQuota,
  onUpgrade,
  renderChangeExtra,
  isPro,
}: {
  application: ApplicationDetailDTO | null
  template: TemplateId
  onTemplate: (id: TemplateId) => void
  onChange: (application: ApplicationDetailDTO) => void
  onBack: () => void
  onAnotherJob: () => void
  coverLetterQuota: Quota | null
  onCoverLetterQuota: (quota: Quota) => void
  onUpgrade: (reason?: string) => void
  /** Extra action per bullet in the Changes tab (the evidence interview's "Make it stronger"). */
  renderChangeExtra?: (change: ApplicationDetailDTO["changes"][number]) => React.ReactNode
  isPro: boolean
}) {
  const [tab, setTab] = useState<Tab>("changes")
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState("")

  const highlight = useMemo(
    () => new Set((application?.changes ?? []).filter((c) => c.status === "accepted").map((c) => c.after)),
    [application]
  )

  if (!application) {
    return (
      <Card wide>
        <CardHeader title="Result" onBack={onBack} />
      </Card>
    )
  }

  const decide = async (changeId: string, status: "accepted" | "reverted") => {
    setPending(changeId)
    setError("")
    const result = await decideChange(application.id, changeId, status)
    setPending(null)
    if (result.ok) onChange(result.application)
    else setError(result.error)
  }

  const { keywords, warnings, changes } = application
  // Older results didn't store what the master covered; don't mark everything as new.
  const knowsBefore = keywords.presentBefore.length > 0 || application.coverageBefore === 0
  const newlyCovered = knowsBefore ? keywords.presentAfter.filter((k) => !keywords.presentBefore.includes(k)) : []

  const tabs: { id: Tab; label: string; count?: number; mobileOnly?: boolean }[] = [
    { id: "preview", label: "Preview", mobileOnly: true },
    { id: "changes", label: "Changes", count: changes.length },
    { id: "keywords", label: "Keywords" },
    { id: "warnings", label: "Warnings", count: warnings.length },
    { id: "letter", label: "Cover letter", count: application.coverLetter?.warnings.length || undefined },
  ]

  const preview = (
    <div className="space-y-3">
      <div className="flex items-center gap-1 rounded-lg bg-white/5 p-1 text-xs" role="radiogroup" aria-label="Template">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={template === t.id}
            onClick={() => onTemplate(t.id)}
            className={cn("flex-1 rounded-md px-3 py-1.5", template === t.id ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200")}
          >
            {t.name}
          </button>
        ))}
      </div>
      <ResumeDocument resume={application.tailored} template={template} highlight={highlight} />
    </div>
  )

  const panels: Record<Exclude<Tab, "preview">, React.ReactNode> = {
    changes: (
      <div className="space-y-3">
        {error && <ErrorNote>{error}</ErrorNote>}
        {changes.length === 0 && <p className="text-sm text-slate-400">No bullet changes for this job.</p>}
        {changes.map((c) => {
          const reverted = c.status === "reverted"
          return (
            <div key={c.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-sm">
              <p className="mb-1.5 text-xs font-medium text-slate-500">{c.entryLabel}</p>
              {c.before && (
                <p className={cn("text-slate-400", !reverted && "line-through decoration-slate-600")}>{c.before}</p>
              )}
              <p className={cn("mt-1", reverted ? "text-slate-500 line-through decoration-slate-600" : "text-slate-100")}>{c.after}</p>
              {c.reason && <p className="mt-1.5 text-xs text-emerald-300/80">{c.reason}</p>}
              <div className="mt-2 flex gap-2">
                <button
                  disabled={pending === c.id || !reverted}
                  onClick={() => void decide(c.id, "accepted")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-xs",
                    !reverted ? "bg-emerald-500/15 text-emerald-300" : "border border-white/10 text-slate-300 hover:bg-white/5"
                  )}
                >
                  <Check className="h-3 w-3" /> {reverted ? "Accept" : "Accepted"}
                </button>
                <button
                  disabled={pending === c.id || reverted || !c.before}
                  onClick={() => void decide(c.id, "reverted")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-xs",
                    reverted ? "bg-white/10 text-slate-200" : "border border-white/10 text-slate-300 hover:bg-white/5 disabled:opacity-40"
                  )}
                >
                  <RotateCcw className="h-3 w-3" /> {reverted ? "Reverted" : "Revert"}
                </button>
                {renderChangeExtra?.(c)}
              </div>
            </div>
          )
        })}
      </div>
    ),
    keywords: (
      <div className="space-y-4 text-sm">
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-400">
            <span>Keyword coverage</span>
            <span>
              {application.coverageBefore ?? 0}% → <span className="font-semibold text-emerald-300">{application.coverageAfter ?? 0}%</span>
            </span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-white/5">
            <div className="absolute inset-y-0 left-0 bg-emerald-500/80" style={{ width: `${application.coverageAfter ?? 0}%` }} />
            <div className="absolute inset-y-0 left-0 bg-slate-500" style={{ width: `${application.coverageBefore ?? 0}%` }} />
          </div>
        </div>
        {keywords.presentAfter.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-400">Covered</p>
            <div className="flex flex-wrap gap-1.5">
              {keywords.presentAfter.map((k) => (
                <span key={k} className={cn("rounded-full px-2.5 py-0.5 text-xs", newlyCovered.includes(k) ? "bg-emerald-500/20 text-emerald-200" : "bg-white/5 text-slate-300")}>
                  {k}
                  {newlyCovered.includes(k) && " ↑"}
                </span>
              ))}
            </div>
          </div>
        )}
        {keywords.missing.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-400">Missing</p>
            <div className="flex flex-wrap gap-1.5">
              {keywords.missing.map((k) => (
                <span key={k} className="rounded-full bg-amber-400/10 px-2.5 py-0.5 text-xs text-amber-200">{k}</span>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              These aren&apos;t in your resume, so we didn&apos;t add them. If they&apos;re true for you, add them to your resume and tailor again.
            </p>
          </div>
        )}
      </div>
    ),
    warnings: (
      <div className="space-y-2 text-sm">
        {warnings.length === 0 ? (
          <p className="flex items-center gap-2 text-slate-300">
            <ShieldCheck className="h-4 w-4 text-emerald-400" /> Nothing to flag. Every fact matches your resume.
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-400">The AI tried these; our fact check undid them.</p>
            {warnings.map((w, i) => (
              <div key={i} className="rounded-lg border border-amber-400/15 bg-amber-400/5 p-3">
                <p className="mb-0.5 flex items-center gap-1.5 text-xs font-medium text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5" /> {WARNING_LABEL[w.type] ?? w.type}
                </p>
                <p className="text-slate-300">{w.message}</p>
              </div>
            ))}
          </>
        )}
      </div>
    ),
    letter: (
      <CoverLetterPanel
        application={application}
        quota={coverLetterQuota}
        onChange={onChange}
        onQuota={onCoverLetterQuota}
        onUpgrade={onUpgrade}
      />
    ),
  }

  return (
    <Card wide>
      <CardHeader
        title={`${application.jobTitle} at ${application.company}`}
        subtitle={`Keywords ${application.coverageBefore ?? 0}% → ${application.coverageAfter ?? 0}% · ${changes.length} changes`}
        onBack={onBack}
        right={
          <div className="hidden items-center gap-2 sm:flex">
            <SecondaryButton onClick={onAnotherJob}>
              Tailor for another job <ArrowRight className="h-3.5 w-3.5" />
            </SecondaryButton>
            <DownloadMenu application={application} template={template} isPro={isPro} onUpgrade={onUpgrade} />
          </div>
        }
      />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="hidden min-h-0 overflow-y-auto border-r border-white/5 bg-slate-950/40 p-4 lg:block">{preview}</div>
        <div className="flex min-h-0 flex-col">
          <div role="tablist" className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/5 px-3 pt-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm",
                  t.mobileOnly && "lg:hidden",
                  tab === t.id ? "border-emerald-400 text-white" : "border-transparent text-slate-400 hover:text-slate-200"
                )}
              >
                {t.label}
                {t.count ? <span className="ml-1.5 rounded-full bg-white/10 px-1.5 text-[11px]">{t.count}</span> : null}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4" role="tabpanel">
            {tab === "preview" ? <div className="lg:hidden">{preview}</div> : panels[tab]}
            {tab === "preview" && <div className="hidden lg:block">{panels.changes}</div>}
          </div>
          <div className="flex shrink-0 gap-2 border-t border-white/5 p-3 sm:hidden">
            <SecondaryButton className="flex-1" onClick={onAnotherJob}>
              Another job
            </SecondaryButton>
            <DownloadMenu application={application} template={template} className="flex-1" isPro={isPro} onUpgrade={onUpgrade} />
          </div>
        </div>
      </div>
    </Card>
  )
}
