"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export const STEPS = ["Resume", "Job", "Tailor", "Result"] as const

export function StepRail({
  current,
  completed,
  onSelect,
}: {
  current: number
  completed: boolean[]
  onSelect: (step: number) => void
}) {
  return (
    <nav aria-label="Progress" className="flex h-10 shrink-0 items-center justify-center px-4">
      <ol className="flex items-center gap-1 text-sm">
        {STEPS.map((label, i) => {
          const done = completed[i]
          // Resume is always reachable: it's where Replace lives.
          const clickable = i === 0 || (i !== current && (done || i < current))
          return (
            <li key={label} className="flex items-center gap-1">
              {i > 0 && <Stitch sewn={!!completed[i - 1]} />}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onSelect(i)}
                aria-current={i === current ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors",
                  i === current ? "bg-surface-raised text-text" : done ? "text-success hover:bg-surface-raised" : "text-text-muted",
                  clickable ? "cursor-pointer" : "cursor-default"
                )}
              >
                {done && i !== current ? <Check className="h-3.5 w-3.5" /> : <span className="w-3.5 text-center text-xs">{i + 1}</span>}
                {label}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// The thread between two steps: faint stitches, sewn in coral once the step before is done.
const stitches = (color: string) => `repeating-linear-gradient(90deg, rgb(var(${color})) 0 5px, transparent 5px 9px)`

function Stitch({ sewn }: { sewn: boolean }) {
  return (
    <span
      aria-hidden
      className="mx-0.5 h-[3px] w-4 rounded-full bg-no-repeat transition-[background-size] duration-700 ease-out motion-reduce:transition-none sm:mx-1 sm:w-8"
      style={{
        backgroundImage: `${stitches("--accent")}, ${stitches("--text-faint")}`,
        backgroundSize: `${sewn ? 100 : 0}% 100%, 100% 100%`,
      }}
    />
  )
}
