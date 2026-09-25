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
      <ol className="flex items-center gap-1 text-[13px]">
        {STEPS.map((label, i) => {
          const done = completed[i]
          // Resume is always reachable: it's where Replace lives.
          const clickable = i === 0 || (i !== current && (done || i < current))
          return (
            <li key={label} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden className="mx-1 text-slate-600">·</span>}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onSelect(i)}
                aria-current={i === current ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors",
                  i === current ? "bg-white/10 text-white" : done ? "text-emerald-300 hover:bg-white/5" : "text-slate-500",
                  clickable ? "cursor-pointer" : "cursor-default"
                )}
              >
                {done && i !== current ? <Check className="h-3.5 w-3.5" /> : <span className="w-3.5 text-center text-[11px]">{i + 1}</span>}
                {label}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
