import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full rounded-md bg-slate-800/30 px-3 py-2 text-sm",
        "border border-white/10 text-slate-200 placeholder:text-slate-500",
        "transition-all duration-150",
        "hover:border-white/20 hover:bg-slate-800/40",
        "focus:outline-none focus:border-white/30 focus:bg-slate-800/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className
      )}
      {...props}
    />
  )
}

export { Input }
