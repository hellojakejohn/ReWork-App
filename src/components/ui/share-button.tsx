"use client"

// Share a card (src/lib/share.ts) as a row of round logo buttons: X and LinkedIn with the
// post filled in, copy link, save the image (Instagram, a DM), and on phones the share sheet
// with the card image itself. Every link carries ref=share-... so /admin can count what each brings.
import { Download, Link2, Share2 } from "lucide-react"
import { toast } from "sonner"
import { linkedInShareUrl, shareImagePath, shareText, shareUrl, xIntentUrl, type ShareCard } from "@/lib/share"

function XLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
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
  // On phones: share the card image itself (with the words and link) where the share sheet
  // takes files, else the link. On computers: copy the words and link.
  const more = async () => {
    const url = shareUrl(window.location.origin, card)
    const text = shareText(card)
    if (typeof navigator.share === "function") {
      try {
        const res = await fetch(shareImagePath(card))
        const file = new File([await res.blob()], "rework-card.png", { type: "image/png" })
        const withImage = { files: [file], text: `${text} ${url}`, title: "ReWork" }
        if (navigator.canShare?.(withImage)) await navigator.share(withImage)
        else await navigator.share({ title: "ReWork", text, url })
        return
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return
      }
    }
    await copyLink()
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText(card)} ${shareUrl(window.location.origin, card)}`)
      toast.success("Copied. Paste it in a post or a message: the link shows the card.")
    } catch {
      toast.error("Couldn't copy. Try saving the image instead.")
    }
  }

  const round = "flex h-10 w-10 items-center justify-center rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text/40"
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="mr-1 text-sm font-semibold text-text">Share</span>
        <button type="button" className={`${round} bg-[#000] text-white`} onClick={() => openWindow(xIntentUrl(window.location.origin, card))} aria-label="Share on X" title="Share on X">
          <XLogo />
        </button>
        <button type="button" className={`${round} bg-[#0A66C2] text-white`} onClick={() => openWindow(linkedInShareUrl(window.location.origin, card))} aria-label="Share on LinkedIn" title="Share on LinkedIn">
          <LinkedInLogo />
        </button>
        <button type="button" className={`${round} border border-border bg-surface text-text`} onClick={() => void copyLink()} aria-label="Copy link" title="Copy link">
          <Link2 className="h-4 w-4" />
        </button>
        <a href={shareImagePath(card)} download="rework-card.png" className={`${round} border border-border bg-surface text-text`} aria-label="Save image" title="Save image">
          <Download className="h-4 w-4" />
        </a>
        <button type="button" className={`${round} border border-border bg-surface text-text sm:hidden`} onClick={() => void more()} aria-label="More ways to share" title="More">
          <Share2 className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1.5 text-xs text-text-muted">Only the numbers are shared: no name, job or resume.</p>
    </div>
  )
}
