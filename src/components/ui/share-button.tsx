"use client"

// Share a card (src/lib/share.ts): the phone's share sheet when there is one, else copy the
// link. "Save image" downloads the card for Instagram, LinkedIn or a DM.
import { Download, Share2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { shareImagePath, shareText, shareUrl, type ShareCard } from "@/lib/share"

export function ShareButtons({ card, className }: { card: ShareCard; className?: string }) {
  const share = async () => {
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
        <Button variant="secondary" size="sm" onClick={() => void share()}>
          <Share2 className="h-4 w-4" /> Share
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
