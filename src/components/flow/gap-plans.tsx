"use client"

// Close the gap: what it would take to really gain the skills a job wants and the resume
// doesn't show. Nothing goes on the resume from here; once they've done it, the skill
// check's "Yes" adds what they say.
import { useMemo, useState } from "react"
import { ExternalLink, Route } from "lucide-react"
import { Button } from "@/components/ui/button"
import { loadGapPlans, type GapPlanDTO } from "./api"
import { ErrorNote } from "./ui"
import { skillDemand } from "@/lib/skill-demand"
import { skillLabel } from "@/lib/utils"

export function GapPlans({ resumeId, skills, className }: { resumeId: string; skills: string[]; className?: string }) {
  const [state, setState] = useState<{ phase: "idle" | "loading" } | { phase: "done"; plans: GapPlanDTO[]; partner: boolean } | { phase: "error"; error: string }>({ phase: "idle" })
  const list = skills.slice(0, 8)
  if (list.length === 0) return null

  const load = async () => {
    setState({ phase: "loading" })
    const r = await loadGapPlans(resumeId, list)
    setState(r.ok ? { phase: "done", plans: r.plans, partner: r.partnerLinks } : { phase: "error", error: r.error })
  }

  if (state.phase === "error")
    return (
      <div className={className}>
        <ErrorNote>{state.error}</ErrorNote>
      </div>
    )
  if (state.phase !== "done")
    return (
      <div className={className}>
        <Button variant="secondary" size="sm" onClick={() => void load()} loading={state.phase === "loading"}>
          {state.phase === "idle" && <Route className="h-4 w-4" />} What would it take to close the gap?
        </Button>
      </div>
    )
  return (
    <div className={className}>
      <p className="text-sm font-medium text-text">Closing the gap</p>
      <p className="mt-0.5 text-xs text-text-muted">Rough times at a few hours a week. Once you&apos;ve done one, answer &ldquo;Yes&rdquo; in the skill check and say how, and we&apos;ll add it.</p>
      <ul className="mt-3 space-y-2">
        {state.plans.map((p) => (
          <li key={p.skill} className="rounded-card border border-border bg-surface-raised p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-medium text-text">{skillLabel(p.skill)}</span>
              <span className={p.closeable ? "text-xs text-text-muted" : "text-xs font-medium text-warn"}>{p.time}</span>
            </div>
            <p className="mt-1 text-text-secondary">{p.learn}</p>
            {p.build && (
              <p className="mt-1 text-text-secondary">
                <span className="font-medium text-text">Prove it:</span> {p.build}
              </p>
            )}
            {p.addAs && <p className="mt-1 text-xs text-text-muted">On your resume once done: {p.addAs}</p>}
            {p.links.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {p.links.map((l) => (
                  <a
                    key={l.label}
                    href={l.href}
                    target="_blank"
                    rel={l.partner ? "sponsored noopener noreferrer" : "noopener noreferrer"}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-accent-strong hover:underline"
                  >
                    {l.label} <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {state.partner && <p className="mt-2 text-xs text-text-muted">Some course links earn ReWork a small commission. It never changes what we suggest.</p>}
    </div>
  )
}

/** Under the matches: the skills missing from the most of them, and what it would take. */
export function SkillDemandCard({ resumeId, matches }: { resumeId: string; matches: { missing: string[]; score: number }[] }) {
  const demand = useMemo(() => (matches.length >= 3 ? skillDemand(matches) : []), [matches])
  if (demand.length === 0) return null
  return (
    <div className="rounded-card border border-border bg-surface-raised p-4">
      <p className="text-sm font-medium text-text">Skills that would open the most jobs</p>
      <p className="mt-0.5 text-xs text-text-muted">Missing from your resume, counted across these {matches.length} matches.</p>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {demand.map((d) => (
          <li key={d.skill} className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-text">
            {skillLabel(d.skill)} <span className="text-text-muted">· {d.jobs} jobs</span>
          </li>
        ))}
      </ul>
      <GapPlans key={demand.map((d) => d.skill).join("|")} resumeId={resumeId} skills={demand.map((d) => d.skill)} className="mt-3" />
    </div>
  )
}
