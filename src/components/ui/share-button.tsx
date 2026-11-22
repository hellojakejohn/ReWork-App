"use client"

// Share a card (src/lib/share.ts): straight to X or LinkedIn with the post filled in, or
// "More" for the phone's share sheet (copy the link on a computer), or save the image for
// Instagram or a DM. Every link carries ref=share-... so /admin can count what each brings.
import { Download, Share2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { linkedInShareUrl, shareImagePath, shareText, shareUrl, xIntentUrl, type ShareCard } from "@/lib/share"

function XLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function LinkedInLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

const openWindow = (url: string) => window.open(url, "_blank", "noopener,noreferrer,width=600,height=640")

export function ShareButtons({ card, className }: { card: ShareCard; className?: string }) {
  const more = async () => {
    const url = shareUrl(window.location.origin, card)
    const text = shareText(card)
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "ReWork", text, url })
        return
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      toast.success("Copied. Paste it in a post or a message: the link shows the card.")
    } catch {
      toast.error("Couldn't copy. Try Save image instead.")
    }
  }
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-semibold text-text">Share</span>
        <Button variant="secondary" size="sm" onClick={() => openWindow(xIntentUrl(window.location.origin, card))} aria-label="Share on X">
          <XLogo /> X
        </Button>
        <Button variant="secondary" size="sm" onClick={() => openWindow(linkedInShareUrl(window.location.origin, card))} aria-label="Share on LinkedIn">
          <LinkedInLogo /> LinkedIn
        </Button>
        <Button variant="secondary" size="sm" onClick={() => void more()}>
          <Share2 className="h-4 w-4" /> More
        </Button>
        <Button asChild variant="text" size="sm">
          <a href={shareImagePath(card)} download="rework-card.png">
            <Download className="h-4 w-4" /> Save image
          </a>
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-text-muted">Only the numbers are shared: no name, job or resume.</p>
    </div>
  )
}
