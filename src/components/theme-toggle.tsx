"use client"

import { useEffect, useState } from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { THEME_CHANGE_EVENT, THEME_CHOICES, readThemeChoice, setThemeChoice, type ThemeChoice } from "@/lib/theme"

const LABELS: Record<ThemeChoice, string> = { light: "Light", dark: "Dark", system: "System" }
const ICONS = { light: Sun, dark: Moon, system: Monitor }

/** The stored choice (light/dark/system). "system" until mounted, so SSR and first render agree. */
export function useThemeChoice(): ThemeChoice {
  const [choice, setChoice] = useState<ThemeChoice>("system")
  useEffect(() => {
    setChoice(readThemeChoice())
    const onChange = () => setChoice(readThemeChoice())
    window.addEventListener(THEME_CHANGE_EVENT, onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [])
  return choice
}

/** The theme actually on screen, read from the class the inline script sets on <html>. */
export function useResolvedTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light")
  useEffect(() => {
    const root = document.documentElement
    const read = () => setTheme(root.classList.contains("dark") ? "dark" : "light")
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])
  return theme
}

/** Light / Dark / System segmented control (account menu). */
export function ThemeToggle({ className }: { className?: string }) {
  const choice = useThemeChoice()
  return (
    <div role="radiogroup" aria-label="Theme" className={cn("flex rounded-full bg-surface-raised p-0.5", className)}>
      {THEME_CHOICES.map((value) => {
        const Icon = ICONS[value]
        const active = value === choice
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setThemeChoice(value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-full px-2 py-1 text-xs font-semibold transition-colors",
              active ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text"
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {LABELS[value]}
          </button>
        )
      })}
    </div>
  )
}
