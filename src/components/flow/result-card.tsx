"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { TEMPLATES, type TemplateId } from "@/lib/resume-templates"
import { decideChange, type ApplicationDetailDTO, type MasterResumeDTO, type Quota } from "./api"
import { ResumeDocument } from "./resume-document"
import { CoverLetterPanel } from "./cover-letter-panel"
import { DownloadMenu } from "./download-menu"
import { LeftOutList, ReceiptCard, useReceipt } from "./receipt"
import { Card, CardHeader, ErrorNote } from "./ui"

type Tab = "preview" | "changes" | "keywords" | "letter"

export function ResultCard(props: {
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
  /** A left-out claim's real number was written to the master. */
  onMasterSaved?: (master: MasterResumeDTO) => void
  isPro: boolean
}) {
  if (!props.application) {
    return (
      <Card wide>
        <CardHeader title="Result" onBack={props.onBack} />
      </Card>
    )
  }
  return <Result {...props} application={props.application} />
}

function Result({
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
  onMasterSaved,
  isPro,
}: React.ComponentProps<typeof ResultCard> & { application: ApplicationDetailDTO }) {
  const [tab, setTab] = useState<Tab>("preview")
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState("")
  const receipt = useReceipt(application)

  const highlight = useMemo(
    () => new Set(application.changes.filter((c) => c.status === "accepted").map((c) => c.after)),
    [application]
  )

  const decide = async (changeId: string, status: "accepted" | "reverted") => {
    setPending(changeId)
    setError("")
    const result = await decideChange(application.id, changeId, status)
    setPending(null)
    if (result.ok) onChange(result.application)
    else setError(result.error)
  }

  const { keywords, changes } = application
  const newlyCovered = receipt.keywordsAddedList

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "preview", label: "Resume" },
    { id: "changes", label: "Changes", count: changes.length },
    { id: "keywords", label: "Keywords" },
    { id: "letter", label: "Cover letter", count: application.coverLetter?.warnings.length || undefined },
  ]

  const panels: Record<Tab, React.ReactNode> = {
    preview: (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented label="Template" value={template} onChange={onTemplate} options={TEMPLATES.map((t) => ({ id: t.id, label: t.name }))} className="w-full sm:w-56" />
          <p className="hidden text-xs text-text-muted dark:block">The resume stays on paper in dark mode, so you see exactly what you&apos;ll send.</p>
        </div>
        <ResumeDocument resume={application.tailored} template={template} highlight={highlight} />
      </div>
    ),
    changes: (
      <div className="space-y-3">
        {error && <ErrorNote>{error}</ErrorNote>}
        {changes.length === 0 && <p className="text-sm text-text-muted">No bullet changes for this job.</p>}
        {changes.map((c) => {
          const reverted = c.status === "reverted"
          return (
            <div key={c.id} className="rounded-card border border-border p-4 text-sm">
              <p className="mb-1.5 text-xs font-semibold text-text-muted">{c.entryLabel}</p>
              {c.before && <p className={cn("text-text-muted", !reverted && "line-through decoration-text-faint")}>{c.before}</p>}
              <p className={cn("mt-1", reverted ? "text-text-muted line-through decoration-text-faint" : "text-text")}>{c.after}</p>
              {c.reason && <p className="mt-1.5 text-xs text-success">{c.reason}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={reverted ? "secondary" : "inverse"}
                  disabled={pending === c.id || !reverted}
                  onClick={() => void decide(c.id, "accepted")}
                  className="disabled:opacity-100"
                >
                  <Check className="h-3 w-3" /> {reverted ? "Keep" : "Kept"}
                </Button>
                <Button
                  size="sm"
                  variant={reverted ? "inverse" : "secondary"}
                  disabled={pending === c.id || reverted || !c.before}
                  onClick={() => void decide(c.id, "reverted")}
                  className={cn(reverted && "disabled:opacity-100")}
                >
                  <RotateCcw className="h-3 w-3" /> {reverted ? "Reverted" : "Revert"}
                </Button>
                {renderChangeExtra?.(c)}
              </div>
            </div>
          )
        })}
      </div>
    ),
    keywords: (
      <div className="space-y-5 text-sm">
        <div>
          <div className="mb-1.5 flex justify-between text-xs text-text-muted">
            <span>Keyword coverage</span>
            <span>
              {application.coverageBefore ?? 0}% → <span className="font-bold text-success">{application.coverageAfter ?? 0}%</span>
            </span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-surface-raised">
            <div className="absolute inset-y-0 left-0 bg-success" style={{ width: `${application.coverageAfter ?? 0}%` }} />
            <div className="absolute inset-y-0 left-0 bg-text-faint" style={{ width: `${application.coverageBefore ?? 0}%` }} />
          </div>
        </div>
        {keywords.presentAfter.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-text-muted">Covered</p>
            <div className="flex flex-wrap gap-1.5">
              {keywords.presentAfter.map((k) => (
                <span key={k} className={cn("rounded-full px-2.5 py-0.5 text-xs", newlyCovered.includes(k) ? "bg-success-tint font-semibold text-text" : "bg-surface-raised text-text-secondary")}>
                  {k}
                  {newlyCovered.includes(k) && <span className="sr-only"> (added)</span>}
                  {newlyCovered.includes(k) && <span aria-hidden> ↑</span>}
                </span>
              ))}
            </div>
          </div>
        )}
        {keywords.missing.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-text-muted">Missing</p>
            <div className="flex flex-wrap gap-1.5">
              {keywords.missing.map((k) => (
                <span key={k} className="rounded-full bg-removed px-2.5 py-0.5 text-xs text-text">
                  {k}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-text-muted">
              These aren&apos;t in your resume, so we didn&apos;t add them. If they&apos;re true for you, add them to your resume and tailor again.
            </p>
          </div>
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
    <Card wide className="bg-bg">
      {/* One scroll on phones; each column scrolls on its own from lg up. */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-y-auto lg:grid-cols-[360px_minmax(0,1fr)] lg:overflow-hidden">
        <aside className="space-y-4 p-4 sm:p-5 lg:min-h-0 lg:overflow-y-auto">
          <div className="flex items-start gap-2">
            <Button variant="text" size="icon-sm" onClick={onBack} className="-ml-1.5 shrink-0" aria-label="Back" title="Back (Esc)">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <p className="pt-1 text-sm text-text-muted">
              {application.jobTitle}
              {application.company && ` · ${application.company}`}
            </p>
          </div>
          <h2 className="font-serif text-3xl font-medium leading-tight tracking-tight text-text">Nice. Here&apos;s what changed.</h2>
          <ReceiptCard receipt={receipt} />
          <LeftOutList
            application={application}
            receipt={receipt}
            isPro={isPro}
            onUpgrade={(reason) => onUpgrade(reason)}
            onMasterSaved={onMasterSaved}
          />
          <div className="space-y-2 pt-1">
            <DownloadMenu application={application} template={template} isPro={isPro} onUpgrade={onUpgrade} className="h-12 w-full text-base" />
            <Button variant="secondary" className="w-full" onClick={onAnotherJob}>
              Tailor for another job <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </aside>

        <div className="flex flex-col p-2 pt-0 sm:p-3 lg:min-h-0 lg:py-3 lg:pl-0">
          <div className="flex flex-col rounded-panel border border-border bg-surface lg:min-h-0 lg:flex-1">
            <div role="tablist" aria-label="Result" className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 pt-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text/40",
                    tab === t.id ? "border-accent text-text" : "border-transparent text-text-muted hover:text-text"
                  )}
                >
                  {t.label}
                  {t.count ? <span className="ml-1.5 rounded-full bg-surface-raised px-1.5 text-xs">{t.count}</span> : null}
                </button>
              ))}
            </div>
            <div className="p-4 sm:p-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto" role="tabpanel">
              {panels[tab]}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
