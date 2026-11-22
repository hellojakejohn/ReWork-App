"use client"

// "First interview." When a tracked job reaches Interview or Offer: confetti, the milestone
// card (src/app/api/og/share) and a way to share it. Numbers only, never the job or company.
import { useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ShareButtons } from "@/components/ui/share-button"
import { celebrate } from "@/components/ui/celebrate"
import { shareHeadline, shareImagePath, type ShareCard } from "@/lib/share"
import type { Milestone } from "@/lib/tracker"

const BODY: Record<Milestone["stage"], string> = {
  interview: "Someone read your resume and wants to talk. That's the whole point. Interview prep for this job is on its result.",
  offer: "All that tailoring paid off. Take a breath, read it carefully, and negotiate if you can.",
}

export function MilestoneDialog({ milestone, onClose }: { milestone: Milestone | null; onClose: () => void }) {
  useEffect(() => {
    if (milestone) celebrate()
  }, [milestone])
  if (!milestone) return null
  const card: ShareCard = { kind: "milestone", ...milestone }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg border border-border bg-surface">
        <DialogHeader>
          <DialogTitle className="font-serif text-3xl font-semibold text-text">{shareHeadline(card)}</DialogTitle>
          <DialogDescription className="text-text-secondary">{BODY[milestone.stage]}</DialogDescription>
        </DialogHeader>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shareImagePath(card)} alt="" width={1200} height={630} className="w-full rounded-card border border-border" />
        <ShareButtons card={card} />
        <div className="flex justify-end">
          <Button variant="text" onClick={onClose}>
            Back to the tracker
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
