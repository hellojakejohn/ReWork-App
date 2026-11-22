"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle")
  const [error, setError] = useState("")

  const go = async () => {
    setState("working")
    try {
      const res = await fetch(`/api/email/unsubscribe?t=${encodeURIComponent(token)}`, { method: "POST" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.ok) {
        setError(body.error || "That didn't work. Please try again.")
        setState("error")
        return
      }
      setState("done")
    } catch {
      setError("That didn't work. Please try again.")
      setState("error")
    }
  }

  if (state === "done") {
    return (
      <p className="rounded-card bg-surface p-4 text-text" role="status">
        Done. You won&apos;t get the weekly email anymore.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      <Button variant="primary" onClick={go} disabled={state === "working"}>
        {state === "working" ? "Unsubscribing..." : "Unsubscribe from weekly emails"}
      </Button>
      {state === "error" && (
        <p className="text-sm text-accent-strong" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
