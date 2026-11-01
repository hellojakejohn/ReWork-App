import { cn } from "@/lib/utils"

// The rework wordmark (brand-kit/BRAND.md, built by scripts/brand/build-logo.mjs).
// Primary = solid letters, for anything under ~80px tall. Hero = engraved letters, never
// under ~80px tall; its cream rim reads on both themes, so it has one file. The swap
// follows the theme class on <html> (CSS only: works in server components and before
// hydration).
const RATIO = 2000 / 714

const FILES = {
  primary: { light: "/brand/rework-logo.webp", dark: "/brand/rework-logo-dark.webp" },
  hero: { light: "/brand/rework-logo-engraved.webp", dark: "/brand/rework-logo-engraved.webp" },
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
      {/* eslint-disable-next-line @next/next/no-img-element -- static WebP sized for 3x screens, nothing for next/image to add */}
      <img {...common} alt="rework" src={files.light} className="block h-full w-full dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img {...common} alt="rework" src={files.dark} className="hidden h-full w-full dark:block" />
    </span>
  )
}
