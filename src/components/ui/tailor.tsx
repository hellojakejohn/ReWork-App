"use client"

// The tailor-shop pieces used across ReWork: a cloth tape measure for any match score, a
// running stitch while something works, and the stitched (dashed) edge for "pattern piece"
// panels. Colors come from the brand tokens (--tape in globals.css); motion respects
// reduced motion (the global rule in globals.css stops it).
import { useEffect, useState } from "react"
import { Scissors } from "lucide-react"
import { cn } from "@/lib/utils"

/** A dashed, sewn-looking edge for panels people fill in. */
export const stitchedEdge = "border-2 border-dashed border-text/20"

const clamp = (n: number) => Math.max(0, Math.min(100, n))

/**
 * A cloth tape measure from 0 to 100. The fill and needle slide from 0 to `value` on mount.
 * `from` shows an earlier score underneath (before and after a tailor). `reach` shows where
 * a tailor could take it, as a basting stitch past the fill. `size="sm"` drops the numbers.
 */
export function TapeMeasure({
  value,
  from,
  reach,
  size = "md",
  className,
}: {
  value: number
  from?: number
  reach?: number
  size?: "sm" | "md"
  className?: string
}) {
  const [at, setAt] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setAt(clamp(value)))
    return () => cancelAnimationFrame(id)
  }, [value])
  const md = size === "md"
  const slide = "motion-safe:duration-1000 motion-safe:ease-out"
  return (
    <div className={className} aria-hidden>
      <div className={cn("relative overflow-hidden border border-text/15 bg-[rgb(var(--tape))]", md ? "h-12 rounded-md" : "h-3 rounded-sm")}>
        <div className={cn("absolute inset-0", md ? "fit-tape-ticks" : "fit-tape-ticks-sm")} />
        {md &&
          [0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map((n) => (
            <span key={n} className="absolute bottom-1 text-[10px] font-semibold tabular-nums text-text/70" style={{ left: `calc(${n}% + 3px)` }}>
              {n}
            </span>
          ))}
        {reach !== undefined && reach > value && (
          <div
            className="absolute inset-y-0 border-r-2 border-dashed border-success/70 bg-success/10"
            style={{ left: `${clamp(value)}%`, width: `${clamp(reach) - clamp(value)}%` }}
          />
        )}
        <div className={cn("absolute inset-y-0 left-0 bg-success/30 motion-safe:transition-[width]", slide)} style={{ width: `${at}%` }} />
        {from !== undefined && <div className="absolute inset-y-0 left-0 bg-text/10" style={{ width: `${clamp(Math.min(from, value))}%` }} />}
      </div>
      <div className={cn("relative", md ? "h-3" : "h-2")}>
        <div
          className={cn(
            "absolute -top-1 h-0 w-0 -translate-x-1/2 border-x-transparent border-b-accent motion-safe:transition-[left]",
            md ? "border-x-[7px] border-b-[9px]" : "border-x-[5px] border-b-[6px]",
            slide
          )}
          style={{ left: `${at}%` }}
        />
      </div>
    </div>
  )
}

/** A running stitch with scissors, for "working on it". */
export function Stitching({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 text-sm text-text-muted", className)} role="status">
      <Scissors className="h-4 w-4 shrink-0" aria-hidden />
      <svg viewBox="0 0 240 8" className="h-2 w-40 shrink-0 sm:w-60" aria-hidden>
        <line x1="0" y1="4" x2="240" y2="4" stroke="currentColor" strokeWidth="2" strokeDasharray="8 6" className="fit-stitch" />
      </svg>
      <span>{label}</span>
    </div>
  )
}
