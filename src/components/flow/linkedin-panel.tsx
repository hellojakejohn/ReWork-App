"use client"

// The Result card's LinkedIn tab: the tailored resume split into the fields LinkedIn has,
// each with its own Copy button.
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { linkedInBlocks, linkedInText } from "@/lib/linkedin-text"
import type { ParsedResume } from "@/types/parsed-resume"

export function LinkedInPanel({ resume }: { resume: ParsedResume }) {
  const blocks = useMemo(() => linkedInBlocks(resume), [resume])
  const [copied, setCopied] = useState<string | null>(null)

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000)
    } catch {
      toast.error("Couldn't copy. Select the text and copy it instead.")
    }
  }

  if (blocks.length === 0) return <p className="text-sm text-text-muted">Nothing to copy yet.</p>

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-text-muted">
          Your LinkedIn profile is the first thing a recruiter checks after your resume. Paste these so the two tell the same story.
        </p>
        <Button variant="secondary" size="sm" onClick={() => void copy("all", linkedInText(blocks))}>
          {copied === "all" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied === "all" ? "Copied" : "Copy all"}
        </Button>
      </div>
      {blocks.map((b) => (
        <div key={b.id} className="rounded-card border border-border p-4">
          <div className="mb-2 flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-text">{b.label}</p>
              <p className="text-xs text-text-muted">{b.hint}</p>
            </div>
            <Button variant={copied === b.id ? "inverse" : "secondary"} size="sm" onClick={() => void copy(b.id, b.text)} aria-label={`Copy ${b.label}`}>
              {copied === b.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied === b.id ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="whitespace-pre-line leading-relaxed text-text-secondary">{b.text}</p>
          {b.tooLong && <p className="mt-2 text-xs text-warn">This is longer than LinkedIn allows for this field. Trim it after pasting.</p>}
        </div>
      ))}
    </div>
  )
}
