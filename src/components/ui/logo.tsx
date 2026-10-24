import { cn } from "@/lib/utils"

// The rework wordmark (brand-kit/BRAND.md). Primary = solid letters, for anything under
// ~80px tall. Hero = engraved letters, never under ~80px tall. The light and dark files
// paint the thread-crossing gaps in their page color, so the swap follows the theme class
// on <html> (CSS only: works in server components and before hydration).
const RATIO = 1608 / 575

const FILES = {
  primary: { light: "/brand/rework-logo.svg", dark: "/brand/rework-logo-dark.svg" },
  hero: { light: "/brand/rework-logo-engraved.svg", dark: "/brand/rework-logo-engraved-dark.svg" },
}

export function Logo({
  height = 32,
  variant = "primary",
  className,
  priority = false,
}: {
  /** Rendered height in px; width follows the artwork's ratio. */
  height?: number
  variant?: "primary" | "hero"
  className?: string
  priority?: boolean
}) {
  const width = Math.round(height * RATIO)
  const files = FILES[variant]
  const common = {
    width,
    height,
    decoding: "async" as const,
    fetchPriority: priority ? ("high" as const) : undefined,
    loading: priority ? undefined : ("lazy" as const),
  }
  return (
    <span className={cn("inline-flex shrink-0", className)} style={{ width, height }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing for next/image to optimize */}
      <img {...common} alt="rework" src={files.light} className="block h-full w-full dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img {...common} alt="rework" src={files.dark} className="hidden h-full w-full dark:block" />
    </span>
  )
}
