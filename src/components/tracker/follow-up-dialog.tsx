"use client"

// The follow-up email for one tracked job: edit it, copy it or open it in the mail app,
// then "remind me in a week" (sets the follow-up date). Used on Home and on the tracker.
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Copy, Mail } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FOLLOW_UP_AFTER_DAYS, addDaysISO, followUpEmail, mailtoHref } from "@/lib/follow-up"
import { columnOf } from "@/lib/tracker"
import type { TrackerCardDTO } from "@/components/flow/api"

const field = "w-full rounded-input border border-input bg-surface px-3 py-2 text-sm text-text focus:border-text focus:outline-none"

export function FollowUpDialog({
  app,
  open,
  onClose,
  onSnooze,
}: {
  app: TrackerCardDTO
  open: boolean
  onClose: () => void
  /** Saves the next follow-up date (YYYY-MM-DD). */
  onSnooze: (followUpAt: string) => Promise<boolean> | boolean | void
}) {
  const { data: session } = useSession()
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const email = followUpEmail({ jobTitle: app.jobTitle, company: app.company, appliedAt: app.appliedAt, column: columnOf(app.status) }, session?.user?.name ?? "")
    setSubject(email.subject)
    setBody(email.body)
  }, [open, app.jobTitle, app.company, app.appliedAt, app.status, session?.user?.name])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`)
      toast.success("Copied. Paste it into an email to the recruiter or hiring manager.")
    } catch {
      toast.error("Couldn't copy. Select the text and copy it instead.")
    }
  }

  const snooze = async () => {
    setSaving(true)
    const ok = await onSnooze(addDaysISO(new Date(), FOLLOW_UP_AFTER_DAYS))
    setSaving(false)
    if (ok !== false) {
      toast.success(`We'll remind you in ${FOLLOW_UP_AFTER_DAYS} days if you haven't heard back.`)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg border border-border bg-surface">
        <DialogHeader>
          <DialogTitle className="text-text">Follow up with {app.company}</DialogTitle>
          <DialogDescription className="text-text-muted">
            A short, polite check-in gets more replies than waiting. Send it to the recruiter or hiring manager if you know who it is.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-text-muted">Subject</span>
            <input className={field} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-text-muted">Email</span>
            <textarea className={`${field} min-h-[220px] leading-relaxed`} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={() => void copy()}>
            <Copy className="h-4 w-4" /> Copy
          </Button>
          <Button asChild variant="secondary">
            <a href={mailtoHref({ subject, body })}>
              <Mail className="h-4 w-4" /> Open in email
            </a>
          </Button>
          <Button variant="text" className="sm:ml-auto" loading={saving} onClick={() => void snooze()}>
            Sent. Remind me in a week
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
