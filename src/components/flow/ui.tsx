"use client"

// Small shared pieces for the flow cards.
import { ArrowLeft, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

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
        "flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70",
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
    <div className="flex items-start gap-3 border-b border-white/5 px-5 py-4">
      {onBack && (
        <button
          onClick={onBack}
          className="-ml-1 mt-0.5 rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-white"
          aria-label="Back"
          title="Back (Esc)"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-slate-100">{title}</h2>
        {subtitle && <div className="mt-0.5 text-sm text-slate-400">{subtitle}</div>}
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
  return <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/5 px-5 py-3">{children}</div>
}

export function PrimaryButton({
  children,
  loading,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

export function SecondaryButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  )
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
      {children}
    </p>
  )
}

export function ReviewDot({ title }: { title?: string }) {
  return <span title={title} aria-label={title || "Needs review"} className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-400" />
}

export const inputClass =
  "w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"

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
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-slate-950">✓</span>
            ) : state === "active" ? (
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
            ) : (
              <span className="h-4 w-4 rounded-full border border-white/15" />
            )}
            <span className={state === "todo" ? "text-slate-500" : state === "active" ? "text-slate-100" : "text-slate-400"}>
              {stage.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
