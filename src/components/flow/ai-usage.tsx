"use client"

// The AI cap, as the user sees it: a small "Monthly usage" bar in the account menu, and
// a dismissible header banner while paid calls run on the lighter model (75-100%).
// Percent and dates only, never dollars. Data: GET /api/account/ai-usage.
import { useEffect, useState } from "react"
import { X } from "lucide-react"

export interface AIUsage {
  percent: number
  band: "normal" | "downgrade" | "paused"
  resetAt: string
  downgraded: boolean
  banner: string | null
  pausedMessage: string | null
}

/** Refetches whenever `refreshKey` changes (pass something that changes after AI work). */
export function useAIUsage(refreshKey: unknown): AIUsage | null {
  const [usage, setUsage] = useState<AIUsage | null>(null)
  useEffect(() => {
    let alive = true
    fetch("/api/account/ai-usage", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (alive && data && typeof data.percent === "number") setUsage(data as AIUsage)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [refreshKey])
  return usage
}

const dismissKey = (usage: AIUsage) => `rework:ai-banner-dismissed:${usage.band}:${usage.resetAt}`

function readDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1"
  } catch {
    return false
  }
}

/** One line under the header: the 75% band's model switch, or the 100% pause. */
export function AIUsageBanner({ usage }: { usage: AIUsage | null }) {
  const text = usage?.band === "paused" ? usage.pausedMessage : usage?.banner
  const key = usage ? dismissKey(usage) : ""
  const [dismissed, setDismissed] = useState(true)
  useEffect(() => {
    setDismissed(key ? readDismissed(key) : true)
  }, [key])
  if (!usage || !text || dismissed) return null
  return (
    <div
      role="status"
      className={`flex items-center gap-3 border-b px-4 py-1.5 text-xs sm:px-6 ${
        usage.band === "paused" ? "border-amber-500/20 bg-amber-500/10 text-amber-200" : "border-white/5 bg-slate-900 text-slate-300"
      }`}
    >
      <span className="flex-1">{text}</span>
      <button
        onClick={() => {
          setDismissed(true)
          try {
            window.localStorage.setItem(key, "1")
          } catch {
            // private mode: dismissed for this page view only
          }
        }}
        aria-label="Dismiss"
        className="rounded p-0.5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/** Tiny bar for the account menu. */
export function AIUsageMeter({ usage }: { usage: AIUsage | null }) {
  if (!usage) return null
  const color = usage.band === "paused" ? "bg-amber-400" : usage.band === "downgrade" ? "bg-amber-300" : "bg-emerald-400"
  const reset = new Date(usage.resetAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
  return (
    <div className="mt-2" title={`Resets ${reset}`}>
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>Monthly usage</span>
        <span>{usage.percent}%</span>
      </div>
      <div
        className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-label="Monthly usage"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={usage.percent}
      >
        <div className={`h-full ${color}`} style={{ width: `${Math.max(2, usage.percent)}%` }} />
      </div>
    </div>
  )
}
