"use client"

import { useEffect, useRef, useState } from "react"
import { Bookmark, Loader2 } from "lucide-react"
import { savedJobFromHash, storeSavedJob } from "@/lib/saved-job"
import { saveJobBookmarklet } from "@/lib/save-job-script"

// /save does two things. Opened by the button with #job=..., it keeps the job and goes to
// the dashboard (sign-in first if needed; localStorage survives that). Opened plainly, it
// shows how to add the button.
export function SaveJob() {
  const [handoff, setHandoff] = useState<"checking" | "none" | "saving">("checking")
  const [clicked, setClicked] = useState(false)
  const link = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    const job = savedJobFromHash(window.location.hash)
    if (job) {
      setHandoff("saving")
      storeSavedJob(job)
      window.location.replace("/dashboard")
      return
    }
    setHandoff("none")
  }, [])

  // React refuses javascript: hrefs in JSX, so set it on the element directly.
  useEffect(() => {
    if (handoff === "none") link.current?.setAttribute("href", saveJobBookmarklet(window.location.origin))
  }, [handoff])

  if (handoff !== "none") {
    return (
      <p className="flex items-center gap-2 text-text-muted" aria-live="polite">
        <Loader2 className="h-4 w-4 animate-spin" /> {handoff === "saving" ? "Bringing the job into ReWork..." : "Loading..."}
      </p>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-4xl font-medium tracking-tight text-text sm:text-5xl">Save jobs from LinkedIn and Indeed</h1>
        <p className="mt-4 leading-relaxed">
          LinkedIn and Indeed don&apos;t let other sites open their job links, so pasting one into ReWork doesn&apos;t work. This button reads the job you
          have open, in your own browser, and brings it into ReWork in one click.
        </p>
      </div>

      <div className="rounded-card bg-surface p-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <a
            ref={link}
            href="#"
            draggable
            onClick={(e) => {
              e.preventDefault()
              setClicked(true)
            }}
            className="inline-flex cursor-grab items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg hover:bg-accent-hover active:cursor-grabbing"
          >
            <Bookmark className="h-4 w-4" aria-hidden /> Save to ReWork
          </a>
          <p className="text-sm text-text-muted">Drag this button to your bookmarks bar.</p>
        </div>
        {clicked && (
          <p className="mt-3 text-sm text-text" role="status">
            Drag it instead of clicking it: drop it on your bookmarks bar, then click it there when you&apos;re on a job.
          </p>
        )}
      </div>

      <ol className="list-decimal space-y-3 pl-5 leading-relaxed">
        <li>
          Show your bookmarks bar: <strong className="text-text">Cmd+Shift+B</strong> on a Mac, <strong className="text-text">Ctrl+Shift+B</strong> on Windows.
        </li>
        <li>Drag the Save to ReWork button onto it.</li>
        <li>Open a job on LinkedIn, Indeed or any job site, then click Save to ReWork. ReWork opens with the job filled in for you to check.</li>
      </ol>

      <div className="space-y-2 text-sm leading-relaxed text-text-muted">
        <p>If it can&apos;t find the description, select the description text on the page and click the button again.</p>
        <p>It only runs when you click it, and it only reads the job on that page. Works in Chrome, Edge, Firefox and Safari on a computer. On a phone, copy the description and paste it into ReWork instead.</p>
      </div>
    </div>
  )
}
