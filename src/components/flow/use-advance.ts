"use client"

// Enter advances the active card when its primary action is valid. Ignored while typing
// in a textarea or when focus is on a button/link (Enter already clicks those).
import { useEffect, useRef } from "react"

export function useAdvance(enabled: boolean, advance: () => void) {
  const ref = useRef(advance)
  ref.current = advance

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.key !== "Enter" || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === "TEXTAREA" || tag === "BUTTON" || tag === "A" || tag === "SELECT" || target?.isContentEditable) return
      if (document.querySelector('[role="dialog"]')) return
      e.preventDefault()
      ref.current()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [enabled])
}
