"use client"

import { cn } from "@/lib/utils"

/** A small pill radio group: template picker, cover letter tone, theme. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  label: string
  value: T
  options: { id: T; label: React.ReactNode }[]
  onChange: (id: T) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex items-center gap-0.5 rounded-full bg-surface-raised p-0.5 text-xs", className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1 rounded-full px-3 py-1.5 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text/40 disabled:opacity-50",
            value === o.id ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
