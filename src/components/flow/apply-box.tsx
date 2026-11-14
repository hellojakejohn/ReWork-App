"use client"

// Result card -> Apply: open the real application and let the Save to ReWork extension fill
// it (contact, this tailored resume, the letter, saved answers). The person submits it
// themselves; then one tap moves the job to Applied in the tracker.
import { useState } from "react"
import { toast } from "sonner"
import { Check, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { startApply, updateTracked, type ApplicationDetailDTO } from "./api"

export function ApplyBox({ application }: { application: ApplicationDetailDTO }) {
  const [started, setStarted] = useState(false)
  const [applied, setApplied] = useState(false)
  const [marking, setMarking] = useState(false)
  if (!application.jobUrl) return null

  const open = () => {
    // Open first, inside the click, so the browser doesn't block the new tab.
    window.open(application.jobUrl!, "_blank", "noopener")
    setStarted(true)
    void startApply(application.id).then((r) => !r.ok && toast.error(r.error))
  }

  const markApplied = async () => {
    setMarking(true)
    const r = await updateTracked(application.id, { column: "applied" })
    setMarking(false)
    if (!r.ok) return toast.error(r.error)
    setApplied(true)
    toast.success("Marked as applied. We'll remind you to follow up in a week.")
  }

  return (
    <div className="space-y-2 rounded-card border border-border p-3">
      <Button variant="inverse" className="w-full" onClick={open}>
        Apply at {application.company || "the company"} <ExternalLink className="h-3.5 w-3.5" />
      </Button>
      {started && (
        <div className="space-y-2 text-xs text-text-muted">
          <p>
            On the application form, click the <span className="font-semibold text-text">ReWork</span> button in Chrome&apos;s toolbar: it fills in your details, attaches
            this resume and adds your cover letter and saved answers. Check it, then submit it yourself.{" "}
            <a href="/save" target="_blank" rel="noopener" className="font-medium text-text-secondary underline underline-offset-2 hover:text-text">
              Get the button
            </a>
          </p>
          {applied ? (
            <p className="flex items-center gap-1.5 font-semibold text-text">
              <Check className="h-3.5 w-3.5 text-success" /> In your tracker as Applied
            </p>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => void markApplied()} loading={marking}>
              <Check className="h-3.5 w-3.5" /> I submitted it
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
