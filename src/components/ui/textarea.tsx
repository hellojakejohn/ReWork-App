import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[80px] w-full rounded-input bg-surface px-3 py-2 text-sm",
        "border border-input text-text placeholder:text-text-faint",
        "transition-all duration-150 resize-none",
        "hover:border-text-muted",
        "focus:outline-none focus:border-text focus:ring-1 focus:ring-text/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
