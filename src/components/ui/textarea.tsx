import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[80px] w-full rounded-md bg-slate-800/30 px-3 py-2 text-sm",
        "border border-white/10 text-slate-200 placeholder:text-slate-500",
        "transition-all duration-150 resize-none",
        "hover:border-white/20 hover:bg-slate-800/40",
        "focus:outline-none focus:border-white/30 focus:bg-slate-800/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
