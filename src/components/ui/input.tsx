import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full rounded-input bg-surface px-3 py-2 text-sm",
        "border border-input text-text placeholder:text-text-faint",
        "transition-all duration-150",
        "hover:border-text-muted",
        "focus:outline-none focus:border-text focus:ring-1 focus:ring-text/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className
      )}
      {...props}
    />
  )
}

export { Input }
