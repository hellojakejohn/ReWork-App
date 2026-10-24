"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useResolvedTheme } from "@/components/theme-toggle"

/** Sonner, following the app's theme toggle rather than only the OS setting. */
export function Toaster(props: ToasterProps) {
  const theme = useResolvedTheme()
  return <Sonner theme={theme} {...props} />
}
