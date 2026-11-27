"use client"

// The optional email card under a free-tool result (/check, /fit). Never before the result,
// never a modal, nothing pre-checked. Dismissed or sent = hidden in this browser after.
// Rules and copy: src/lib/leads-shared.ts. Posts to /api/leads.
import { useId, useState } from "react"
import { Mail, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LEAD_COPY, LEAD_FINE_PRINT, readLeadMemory, showLeadCard, writeLeadMemory, type LeadCardMemory, type LeadSource } from "@/lib/leads-shared"

const storage = () => {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

export function LeadCard({ source, missing, className = "" }: { source: LeadSource; missing?: string[]; className?: string }) {
  const id = useId()
  const copy = LEAD_COPY[source]
  // Only ever mounted under a result the browser just fetched (never server-rendered), so
  // reading localStorage on first render is safe and a dismissed card never flashes in.
  const [memory, setMemory] = useState<LeadCardMemory>(() => readLeadMemory(source, storage()))
  const [email, setEmail] = useState("")
  const [website, setWebsite] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [justSent, setJustSent] = useState(false)

  if (!showLeadCard({ hasResult: true, memory, justSent })) return null

  const dismiss = () => {
    writeLeadMemory(source, "dismissed", storage())
    setMemory("dismissed")
    setJustSent(false)
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source, website, ...(source === "fit" && missing ? { missing } : {}) }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "That didn't work. Please try again.")
        return
      }
      writeLeadMemory(source, "sent", storage())
      setJustSent(true)
    } catch {
      setError("Couldn't reach ReWork. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className={`relative rounded-card border border-border bg-surface p-5 ${className}`} aria-label="Get this by email">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-full p-1 text-text-muted hover:bg-surface-raised hover:text-text"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      {justSent ? (
        <p className="pr-8 text-sm text-text" role="status">
          {copy.done}
        </p>
      ) : (
        <form onSubmit={(e) => void send(e)} className="pr-8">
          <label htmlFor={`${id}-email`} className="flex items-start gap-2 text-sm font-semibold text-text">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
            {copy.prompt}
          </label>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              id={`${id}-email`}
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-bg sm:max-w-xs"
            />
            {/* Honeypot: off screen and out of the tab order. People never see it. */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="absolute -left-[9999px] h-px w-px opacity-0"
            />
            <Button type="submit" variant="primary" disabled={busy || !email.trim()} loading={busy} className="shrink-0">
              {copy.button}
            </Button>
          </div>
          <p className="mt-2 text-xs text-text-muted">{LEAD_FINE_PRINT}</p>
          {error && (
            <p className="mt-2 text-sm text-accent-strong" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </aside>
  )
}
