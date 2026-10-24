"use client"

// Small shared pieces for the flow cards.
import { ArrowLeft, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function Card({
  children,
  wide = false,
  className,
}: {
  children: React.ReactNode
  wide?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-panel border border-border bg-surface",
        wide ? "max-w-6xl" : "max-w-2xl",
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string
  subtitle?: React.ReactNode
  onBack?: () => void
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border px-5 py-4">
      {onBack && (
        <Button variant="text" size="icon-sm" onClick={onBack} className="-ml-1 mt-0.5" aria-label="Back" title="Back (Esc)">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="font-serif text-xl font-semibold leading-tight text-text">{title}</h2>
        {subtitle && <div className="mt-0.5 text-sm text-text-muted">{subtitle}</div>}
      </div>
      {right}
    </div>
  )
}

/** The scrolling middle of a card. */
export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4", className)}>{children}</div>
}

export function CardFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">{children}</div>
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-input bg-removed px-3 py-2 text-sm text-text">
      {children}
    </p>
  )
}

export function ReviewDot({ title }: { title?: string }) {
  return <span title={title} aria-label={title || "Needs review"} className="inline-block h-2 w-2 shrink-0 rounded-full bg-warn" />
}

export const inputClass =
  "w-full rounded-input border border-input bg-surface px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-text focus:outline-none focus:ring-1 focus:ring-text/30"

/** Stage list with real progress: done stages get a check, the current one spins. */
export function StageList({ stages, current }: { stages: { id: string; label: string }[]; current: string | null }) {
  const index = stages.findIndex((s) => s.id === current)
  return (
    <ol className="space-y-2" aria-live="polite">
      {stages.map((stage, i) => {
        const state = index === -1 ? "todo" : i < index ? "done" : i === index ? "active" : "todo"
        return (
          <li key={stage.id} className="flex items-center gap-2.5 text-sm">
            {state === "done" ? (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success text-bg">
                <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
              </span>
            ) : state === "active" ? (
              <Loader2 className="h-4 w-4 animate-spin text-text" />
            ) : (
              <span className="h-4 w-4 rounded-full border border-input" />
            )}
            <span className={state === "todo" ? "text-text-muted" : state === "active" ? "font-semibold text-text" : "text-text-secondary"}>
              {stage.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
