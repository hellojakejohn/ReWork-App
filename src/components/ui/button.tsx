import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20",
  {
    variants: {
      variant: {
        default:
          "bg-white text-background font-semibold hover:bg-white/95 hover:shadow-lg hover:transform hover:-translate-y-[1px] active:scale-[0.98]",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 hover:transform hover:-translate-y-[1px] active:scale-[0.98]",
        outline:
          "border border-white/10 bg-transparent hover:bg-white/5 hover:border-white/15 hover:transform hover:-translate-y-[1px]",
        secondary:
          "bg-transparent border border-white/10 hover:bg-white/5 hover:border-white/15 hover:transform hover:-translate-y-[1px]",
        ghost:
          "bg-transparent hover:bg-white/5 text-text-secondary hover:text-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
